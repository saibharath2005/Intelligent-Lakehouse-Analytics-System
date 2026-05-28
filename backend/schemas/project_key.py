from pydantic import BaseModel
from typing import Optional

class APIKeyCreate(BaseModel):
    project_id: int
    provider: str
    api_key: str
    model_name: Optional[str] = None
    temperature: Optional[float] = 0.2
    is_default: Optional[bool] = True

class APIKeyResponse(BaseModel):
    project_id: int
    provider: str
    masked_key: str
    model_name: Optional[str] = None
    temperature: float = 0.2
    is_default: bool = False
