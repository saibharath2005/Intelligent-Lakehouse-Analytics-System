from pydantic import BaseModel

class ChatCreate(BaseModel):
    project_id: int
    message: str

class ChatResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    role: str
    message: str

    class Config:
        from_attributes = True
