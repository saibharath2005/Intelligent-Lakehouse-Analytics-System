from pydantic import BaseModel
from typing import List, Optional


class DashboardCreate(BaseModel):
    name: str
    project_id: int


class DashboardUpdate(BaseModel):
    name: str


class PageCreate(BaseModel):
    name: str
    page_order: int = 0


class PageUpdate(BaseModel):
    name: Optional[str] = None
    page_order: Optional[int] = None


class WidgetCreate(BaseModel):
    dataset_name: str
    query: str
    chart_type: str
    x_axis: Optional[str]
    y_axis: Optional[str]
    pos_x: int = 0
    pos_y: int = 0
    width: int = 4
    height: int = 3


class WidgetUpdate(BaseModel):
    dataset_name: Optional[str] = None
    query: Optional[str] = None
    chart_type: Optional[str] = None
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    pos_x: Optional[int] = None
    pos_y: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None


class WidgetLayoutItem(BaseModel):
    widget_id: int
    pos_x: int
    pos_y: int
    width: int
    height: int


class BulkLayoutUpdate(BaseModel):
    widgets: List[WidgetLayoutItem]