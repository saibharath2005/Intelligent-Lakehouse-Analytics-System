from pydantic import BaseModel

class AnalyzeRequest(BaseModel):
    project_id: int
    dataset: str
    query: str
