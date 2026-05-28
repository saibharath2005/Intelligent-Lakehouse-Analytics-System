from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import SessionLocal
from db.models.chat import ChatHistory
from core.permissions import require_role
from schemas.chat import ChatCreate, ChatResponse
router = APIRouter(prefix="/chat", tags=["AI"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
@router.post("/")
def add_message(
    data: ChatCreate,
    user_id: int , #= Depends(require_role(["owner","editor","viewer"])),
    db: Session = Depends(get_db)
):
    chat = ChatHistory(
        project_id=data.project_id,
        user_id=user_id,
        role="user",
        message=data.message
    )
    db.add(chat)
    db.commit()
    return {"message": "Saved"}
