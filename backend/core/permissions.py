from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from db.session import SessionLocal
from db.models.project_member import ProjectMember
from core.dependencies import get_current_user

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def require_role(allowed_roles: list):
    def checker(
        body: dict,
        user_id: int = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        project_id = body.get("project_id")
        member = db.query(ProjectMember).filter_by(
            project_id=project_id,
            user_id=user_id
        ).first()

        if not member or member.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Access denied")

        return user_id
    return checker
