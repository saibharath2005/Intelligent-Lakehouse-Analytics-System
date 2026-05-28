import os
import shutil
import logging

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.session import SessionLocal
from db.models.project import Project
from db.models.project_member import ProjectMember
from db.models.project_api_key import ProjectAPIKey
from db.models.dataset import Dataset
from db.models.chat import ChatHistory
from db.models.dashboard import Dashboard
from db.models.dashboard_page import DashboardPage
from db.models.dashboard_widget import DashboardWidget
from core.dependencies import get_current_user
from schemas.project import (
    ProjectCreate, ProjectResponse, ProjectDeleteResponse,
    OwnedProjectResponse, ProjectWithDashboardsResponse, DashboardSummary,
    ChangeRoleRequest, InviteMemberRequest, InvitationResponse
)
from db.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/project", tags=["Project"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=ProjectResponse)
def create_project(
    data: ProjectCreate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ── Verify user actually exists in DB before using as FK ──────────────
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Authenticated user not found in database")

    project = Project(name=data.name, created_by=user.id)
    db.add(project)
    db.flush()   # ← generates project.id from sequence without full commit

    member = ProjectMember(
        project_id=project.id,
        user_id=user.id,
        role="owner",
        status="active"  # ← owner is immediately active
    )
    db.add(member)
    db.commit()
    db.refresh(project)

    return project


@router.delete("/{project_id}", response_model=ProjectDeleteResponse)
def delete_project(
    project_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # ── 1. Fetch project & verify ownership ───────────────────────────────
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()
    if not member or member.role != "owner":
        raise HTTPException(status_code=403, detail="Only the project owner can delete a project")

    summary = {
        "project_id":         project_id,
        "project_name":       project.name,
        "widgets_deleted":    0,
        "pages_deleted":      0,
        "dashboards_deleted": 0,
        "datasets_deleted":   0,
        "chats_deleted":      0,
        "api_keys_deleted":   0,
        "members_deleted":    0,
    }

    # ── 2. Dashboards → pages → widgets ───────────────────────────────────
    dashboards = db.query(Dashboard).filter(Dashboard.project_id == project_id).all()
    for dashboard in dashboards:
        pages = db.query(DashboardPage).filter(DashboardPage.dashboard_id == dashboard.id).all()
        for page in pages:
            widget_count = (
                db.query(DashboardWidget)
                .filter(DashboardWidget.page_id == page.id)
                .delete(synchronize_session=False)
            )
            summary["widgets_deleted"] += widget_count
            db.delete(page)
            summary["pages_deleted"] += 1
        db.delete(dashboard)
        summary["dashboards_deleted"] += 1

    # ── 3. Datasets ────────────────────────────────────────────────────────
    datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
    for dataset in datasets:
        if dataset.file_path and os.path.exists(dataset.file_path):
            try:
                os.remove(dataset.file_path)
            except OSError as e:
                logger.warning("Could not remove upload file %s: %s", dataset.file_path, e)
        db.delete(dataset)
        summary["datasets_deleted"] += 1

    for folder in [f"uploads/project_{project_id}", f"data_lake/project_{project_id}"]:
        if os.path.isdir(folder):
            try:
                shutil.rmtree(folder)
            except OSError as e:
                logger.warning("Could not remove dir %s: %s", folder, e)

    # ── 4. Chat history ────────────────────────────────────────────────────
    summary["chats_deleted"] = (
        db.query(ChatHistory)
        .filter(ChatHistory.project_id == project_id)
        .delete(synchronize_session=False)
    )

    # ── 5. API keys ────────────────────────────────────────────────────────
    summary["api_keys_deleted"] = (
        db.query(ProjectAPIKey)
        .filter(ProjectAPIKey.project_id == project_id)
        .delete(synchronize_session=False)
    )

    # ── 6. Project members ─────────────────────────────────────────────────
    summary["members_deleted"] = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .delete(synchronize_session=False)
    )

    # ── 7. Project itself ──────────────────────────────────────────────────
    db.delete(project)
    db.commit()

    return ProjectDeleteResponse(**summary)


@router.get("/owned", response_model=List[OwnedProjectResponse])
def list_owned_projects(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_memberships = (
        db.query(ProjectMember)
        .filter(ProjectMember.user_id == user_id)
        .all()
    )

    project_ids = [m.project_id for m in owned_memberships]
    if not project_ids:
        return []

    projects = (
        db.query(Project)
        .filter(Project.id.in_(project_ids))
        .order_by(Project.created_at.desc())
        .all()
    )

    result = []
    for project in projects:
        result.append(OwnedProjectResponse(
            id=project.id,
            name=project.name,
            created_at=project.created_at,
            member_count=db.query(ProjectMember).filter(ProjectMember.project_id == project.id).count(),
            dataset_count=db.query(Dataset).filter(Dataset.project_id == project.id).count(),
            dashboard_count=db.query(Dashboard).filter(Dashboard.project_id == project.id).count(),
        ))

    return result


@router.get("/my/projects-with-dashboards", response_model=List[ProjectWithDashboardsResponse])
def list_my_projects_with_dashboards(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = (
        db.query(Project)
        .filter(Project.created_by == user_id)
        .order_by(Project.created_at.desc())
        .all()
    )

    result = []
    for project in projects:
        dashboards = (
            db.query(Dashboard)
            .filter(Dashboard.project_id == project.id)
            .order_by(Dashboard.created_at.desc())
            .all()
        )
        dashboard_summaries = []
        for dashboard in dashboards:
            page_count = db.query(DashboardPage).filter(DashboardPage.dashboard_id == dashboard.id).count()
            dashboard_summaries.append(DashboardSummary(
                id=dashboard.id,
                name=dashboard.name,
                created_at=dashboard.created_at,
                page_count=page_count,
            ))

        result.append(ProjectWithDashboardsResponse(
            id=project.id,
            name=project.name,
            created_at=project.created_at,
            dashboards=dashboard_summaries,
        ))

    return result


ALLOWED_ROLES   = {"viewer", "editor", "admin", "owner"}
MEMBER_MANAGERS = {"owner", "admin"}
OWNER_PROTECTED = {"owner"}


def _can_manage_target(caller_role: str, target_role: str) -> bool:
    if caller_role == "owner":
        return True
    if caller_role == "admin":
        return target_role not in OWNER_PROTECTED
    return False


@router.patch("/{project_id}/members/role")
def change_member_role(
    project_id: int,
    data: ChangeRoleRequest,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.new_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{data.new_role}'")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    caller = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()
    if not caller or caller.role not in MEMBER_MANAGERS:
        raise HTTPException(status_code=403, detail="Only owners and admins can change member roles")

    if data.target_user_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    target = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == data.target_user_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target user is not a member of this project")

    if not _can_manage_target(caller.role, target.role):
        raise HTTPException(status_code=403, detail="Admins cannot change the role of the project owner")

    if caller.role == "admin" and data.new_role == "owner":
        raise HTTPException(status_code=403, detail="Admins cannot assign the owner role")

    old_role = target.role
    target.role = data.new_role
    db.commit()

    return {
        "message": "Role updated successfully",
        "project_id": project_id,
        "user_id": data.target_user_id,
        "old_role": old_role,
        "new_role": data.new_role,
    }


@router.post("/{project_id}/members/invite", response_model=InvitationResponse)
def invite_member(
    project_id: int,
    data: InviteMemberRequest,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.user_id is None and not data.email:
        raise HTTPException(status_code=400, detail="Provide either user_id or email")

    if data.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{data.role}'")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    caller = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()
    if not caller or caller.role not in MEMBER_MANAGERS:
        raise HTTPException(status_code=403, detail="Only owners and admins can invite members")

    if caller.role == "admin" and data.role == "owner":
        raise HTTPException(status_code=403, detail="Admins cannot invite members with the owner role")

    if data.user_id is not None:
        target_user = db.query(User).filter(User.id == data.user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail=f"User with id {data.user_id} not found")
    else:
        target_user = db.query(User).filter(User.email == data.email.strip().lower()).first()
        if not target_user:
            raise HTTPException(status_code=404, detail=f"No account found with email '{data.email}'")

    if target_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot invite yourself")

    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == target_user.id,
    ).first()
    if existing:
        if existing.status == "active":
            raise HTTPException(status_code=409, detail="User is already a member of this project")
        if existing.status == "invited":
            raise HTTPException(status_code=409, detail="User already has a pending invitation")

    invitation = ProjectMember(
        project_id=project_id,
        user_id=target_user.id,
        role=data.role,
        status="invited",
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    return invitation


@router.post("/{project_id}/members/accept", response_model=InvitationResponse)
def accept_invitation(
    project_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    invitation = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="No invitation found for this project")
    if invitation.status == "active":
        raise HTTPException(status_code=409, detail="You are already an active member of this project")

    invitation.status = "active"
    db.commit()
    db.refresh(invitation)

    return invitation


@router.get("/{project_id}")
def get_project_detail(
    project_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    caller = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()
    if not caller:
        raise HTTPException(status_code=403, detail="Not a member of this project")

    memberships = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    members = []
    for m in memberships:
        u = db.query(User).filter(User.id == m.user_id).first()
        members.append({
            "user_id":   m.user_id,
            "username":  u.username if u else None,
            "email":     u.email if u else None,
            "role":      m.role,
            "status":    m.status,
            "joined_at": m.joined_at,
        })

    datasets = (
        db.query(Dataset)
        .filter(Dataset.project_id == project_id)
        .order_by(Dataset.created_at.desc())
        .all()
    )
    datasets_out = [
        {"id": d.id, "name": d.name, "status": d.status,
         "uploaded_by": d.uploaded_by, "created_at": d.created_at}
        for d in datasets
    ]

    dashboards = (
        db.query(Dashboard)
        .filter(Dashboard.project_id == project_id)
        .order_by(Dashboard.created_at.desc())
        .all()
    )
    dashboards_out = []
    for d in dashboards:
        page_count = db.query(DashboardPage).filter(DashboardPage.dashboard_id == d.id).count()
        dashboards_out.append({
            "id": d.id, "name": d.name, "created_by": d.created_by,
            "created_at": d.created_at, "page_count": page_count,
        })

    api_keys_out = []
    if caller.role in ("owner", "admin"):
        api_keys = db.query(ProjectAPIKey).filter(ProjectAPIKey.project_id == project_id).all()
        api_keys_out = [
            {
                "provider": (k.provider or "").strip().lower(),
                "masked_key": "****" + (k.encrypted_key or "")[-4:],
                "model_name": k.model_name,
                "temperature": k.temperature,
                "is_default": bool(k.is_default),
                "is_configured": bool(k.encrypted_key),
            }
            for k in api_keys
            if k.provider and k.encrypted_key
        ]

    return {
        "id":         project.id,
        "name":       project.name,
        "created_by": project.created_by,
        "created_at": project.created_at,
        "your_role":  caller.role,
        "members":    members,
        "datasets":   datasets_out,
        "dashboards": dashboards_out,
        "api_keys":   api_keys_out,
    }


@router.get("/datasets/{project_id}")
def list_project_datasets(
    project_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this project")

    datasets = (
        db.query(Dataset)
        .filter(Dataset.project_id == project_id)
        .order_by(Dataset.created_at.desc())
        .all()
    )
    return [
        {"id": d.id, "name": d.name, "status": d.status,
         "uploaded_by": d.uploaded_by, "created_at": d.created_at}
        for d in datasets
    ]
