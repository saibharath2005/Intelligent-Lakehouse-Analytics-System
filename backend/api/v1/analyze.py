from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json

from core.dependencies import get_current_user
from db.session import SessionLocal
from db.models.project_member import ProjectMember
from db.models.dataset import Dataset
from schemas.analyze import AnalyzeRequest
from ai.agent import run_agent

router = APIRouter(prefix="/analyze", tags=["Analyze"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("")
def analyze(
    data: AnalyzeRequest,
    provider: str | None = Query(default=None),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    member = db.query(ProjectMember).filter_by(
        project_id=data.project_id,
        user_id=user_id
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    dataset_record = db.query(Dataset).filter_by(
        project_id=data.project_id,
        name=data.dataset
    ).first()

    if not dataset_record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        result = run_agent(
            project_id=data.project_id,
            dataset=data.dataset,
            query=data.query,
            db=db,
            provider=provider
        )

        # ✅ Ensure consistent structure
        if not isinstance(result, dict):
            result = {"messages": [str(result)]}

        return {
            "project_id": data.project_id,
            "dataset": data.dataset,
            "query": data.query,
            "analysis": result 
        }

    except Exception as e:
        message = str(e)
        if "API key not configured" in message or "Unsupported model provider" in message:
            raise HTTPException(status_code=400, detail=f"Analysis failed: {message}")

        if "RESOURCE_EXHAUSTED" in str(e):
            raise HTTPException(
                status_code=402,
                detail="AI quota exceeded. Please check your API billing."
            )

        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {message}"
        )
