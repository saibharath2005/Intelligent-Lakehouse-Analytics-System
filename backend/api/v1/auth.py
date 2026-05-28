import os
import shutil
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.session import SessionLocal
from db.models.user import User
from schemas.auth import SignupRequest, LoginRequest, UpdateUserRequest
from core.security import hash_pwd, verify, create_token
from core.dependencies import get_current_user
from db.models.project import Project
from db.models.project_member import ProjectMember
from db.models.project_api_key import ProjectAPIKey
from db.models.dataset import Dataset
from db.models.chat import ChatHistory
from db.models.dashboard import Dashboard
from db.models.dashboard_page import DashboardPage
from db.models.dashboard_widget import DashboardWidget

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/signup")
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    # ── Check for duplicate email ─────────────────────────────────────────
    existing = db.query(User).filter(User.email == data.email.strip().lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        username=data.username,
        email=data.email.strip().lower(),
        password_hash=hash_pwd(data.password)
    )
    db.add(user)
    db.flush()       # ← assigns id from sequence WITHOUT full commit
    db.refresh(user) # ← loads the generated id back into the user object
    db.commit()

    return {"message": "User created", "user_id": user.id}


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.strip().lower()).first()
    if not user or not verify(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "access_token": create_token(user.id),
        "token_type": "bearer"
    }


@router.get("/me", summary="Get current user details")
def get_logged_in_user(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.system_role,
        "created_at": user.created_at
    }


@router.delete("/me", summary="Delete own account and all associated data")
def delete_account(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    deleted_projects: list[int] = []
    errors: list[str] = []

    owned_projects = db.query(Project).filter(Project.created_by == user_id).all()

    for project in owned_projects:
        project_id = project.id

        # Dashboard widgets → pages → dashboards
        dashboards = db.query(Dashboard).filter(Dashboard.project_id == project_id).all()
        for dashboard in dashboards:
            pages = db.query(DashboardPage).filter(DashboardPage.dashboard_id == dashboard.id).all()
            for page in pages:
                db.query(DashboardWidget).filter(DashboardWidget.page_id == page.id).delete(synchronize_session=False)
            db.query(DashboardPage).filter(DashboardPage.dashboard_id == dashboard.id).delete(synchronize_session=False)
        db.query(Dashboard).filter(Dashboard.project_id == project_id).delete(synchronize_session=False)

        # Dataset files + data-lake directories
        datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
        for dataset in datasets:
            if dataset.file_path and os.path.exists(dataset.file_path):
                try:
                    os.remove(dataset.file_path)
                except Exception as e:
                    errors.append(f"Could not remove file {dataset.file_path}: {e}")
                    logger.warning("Could not remove upload file %s: %s", dataset.file_path, e)

        for folder in [f"uploads/project_{project_id}", f"data_lake/project_{project_id}"]:
            if os.path.isdir(folder):
                try:
                    shutil.rmtree(folder)
                except Exception as e:
                    errors.append(f"Could not remove dir {folder}: {e}")
                    logger.warning("Could not remove dir %s: %s", folder, e)

        db.query(Dataset).filter(Dataset.project_id == project_id).delete(synchronize_session=False)
        db.query(ChatHistory).filter(ChatHistory.project_id == project_id).delete(synchronize_session=False)
        db.query(ProjectAPIKey).filter(ProjectAPIKey.project_id == project_id).delete(synchronize_session=False)
        db.query(ProjectMember).filter(ProjectMember.project_id == project_id).delete(synchronize_session=False)

        db.delete(project)
        deleted_projects.append(project_id)

    db.flush()

    # Remove user from other projects they're a member of
    db.query(ProjectMember).filter(ProjectMember.user_id == user_id).delete(synchronize_session=False)

    # Remove any remaining chat history tied to the user
    db.query(ChatHistory).filter(ChatHistory.user_id == user_id).delete(synchronize_session=False)

    db.delete(user)
    db.commit()

    logger.info("User %d deleted. Owned projects removed: %s", user_id, deleted_projects)

    return {
        "message": "Account and all associated data permanently deleted",
        "deleted_projects": deleted_projects,
        **({"warnings": errors} if errors else {}),
    }


@router.patch("/me", summary="Update current user profile")
def update_user(
    data: UpdateUserRequest,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.username is not None:
        stripped = data.username.strip()
        if not stripped:
            raise HTTPException(status_code=400, detail="Username cannot be empty")
        user.username = stripped

    if data.email is not None:
        stripped = data.email.strip().lower()
        if not stripped:
            raise HTTPException(status_code=400, detail="Email cannot be empty")
        conflict = db.query(User).filter(
            User.email == stripped,
            User.id != user_id,
        ).first()
        if conflict:
            raise HTTPException(status_code=409, detail="Email already in use by another account")
        user.email = stripped

    if data.new_password is not None:
        if not data.current_password:
            raise HTTPException(status_code=400, detail="current_password is required to set a new password")
        if not verify(data.current_password, user.password_hash):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        if len(data.new_password) < 8:
            raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
        user.password_hash = hash_pwd(data.new_password)

    db.commit()
    db.refresh(user)

    return {
        "message": "Profile updated successfully",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        },
    }