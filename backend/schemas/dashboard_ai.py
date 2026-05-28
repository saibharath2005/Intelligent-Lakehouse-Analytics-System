from pydantic import BaseModel
from typing import List, Optional


class AIWidget(BaseModel):
    type: str  # kpi | bar | line | table
    title: str
    dataset: str
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    aggregation: Optional[str] = None


class AIDashboardRequest(BaseModel):
    action: str  # create | modify | add_widget | remove_widget
    dashboard_id: Optional[int] = None
    widgets: Optional[List[AIWidget]] = None