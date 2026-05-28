from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session

from core.dependencies import get_current_user
from db.session import SessionLocal
from db.models.project_member import ProjectMember
from db.models.dataset import Dataset
from ai.dashboard_agent import run_dashboard_agent, apply_dashboard_plan


router = APIRouter(prefix="/dashboard/ai", tags=["Dashboard AI"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


#  
# Request / Response schemas
#  

class DashboardAIRequest(BaseModel):
    project_id:   int
    prompt:       str
    dashboard_id: Optional[int] = None   # provide when modifying an existing dashboard


class DashboardAIResponse(BaseModel):
    action:          str
    dashboard_id:    Optional[int] = None
    page_id:         Optional[int] = None
    widgets_added:   Optional[int] = None
    widgets_removed: Optional[int] = None
    agent_plan:      dict


#  
# Endpoint
#  

@router.post("/", response_model=DashboardAIResponse)
def generate_dashboard(
    data: DashboardAIRequest,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Natural-language dashboard builder.

    The AI agent will:
    1. Inspect available dataset schemas.
    2. Design appropriate widgets (KPIs, charts, tables).
    3. Persist everything to the database and return the result.

    Examples
    --------
    - "Create a dashboard showing flights by airline and delay statistics"
    - "Add a KPI for total passengers and a line chart of flights per month"
    - "Remove widget 5 from my dashboard"
    """

    # Authorization check
    member = db.query(ProjectMember).filter_by(
        project_id=data.project_id,
        user_id=user_id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    # Discover datasets available in this project
    datasets = db.query(Dataset).filter_by(project_id=data.project_id).all()
    if not datasets:
        raise HTTPException(
            status_code=400,
            detail="No datasets found for this project. Upload a dataset first.",
        )
    dataset_names = [d.name for d in datasets]

    # Run the agentic planning loop
    try:
        plan = run_dashboard_agent(
            project_id=data.project_id,
            user_prompt=data.prompt,
            available_datasets=dataset_names,
            db=db,
            dashboard_id=data.dashboard_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    # Persist the plan
    try:
        summary = apply_dashboard_plan(
            plan=plan,
            project_id=data.project_id,
            user_id=user_id,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Persistence error: {str(e)}")

    return DashboardAIResponse(agent_plan=plan, **summary)