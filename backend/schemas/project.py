from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str


class ProjectResponse(BaseModel):
    id: int
    name: str
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectDeleteResponse(BaseModel):
    project_id:          int
    project_name:        str
    widgets_deleted:     int
    pages_deleted:       int
    dashboards_deleted:  int
    datasets_deleted:    int
    chats_deleted:       int
    api_keys_deleted:    int
    members_deleted:     int


class DashboardSummary(BaseModel):
    id:         int
    name:       str
    created_at: datetime
    page_count: int

    class Config:
        from_attributes = True


class ProjectWithDashboardsResponse(BaseModel):
    id:         int
    name:       str
    created_at: datetime
    dashboards: List["DashboardSummary"]

    class Config:
        from_attributes = True


class OwnedProjectResponse(BaseModel):
    id:              int
    name:            str
    created_at:      datetime
    member_count:    int
    dataset_count:   int
    dashboard_count: int

    class Config:
        from_attributes = True


class ChangeRoleRequest(BaseModel):
    target_user_id: int
    new_role: str  # "viewer" | "editor" | "admin" | "owner"


class InviteMemberRequest(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None
    role: str = "viewer"  # "viewer" | "editor" | "admin" | "owner"


class InvitationResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    role: str
    status: str

    class Config:
        from_attributes = True