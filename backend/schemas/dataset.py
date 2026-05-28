from pydantic import BaseModel

class DatasetCreate(BaseModel):
    project_id: int
