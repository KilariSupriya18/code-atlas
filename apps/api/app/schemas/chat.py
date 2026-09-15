from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class Citation(BaseModel):
    chunk_id: str
    file_path: str
    symbol_name: Optional[str] = None
    start_line: int
    end_line: int
    snippet: str
    claim: Optional[str] = None

class ThreadCreate(BaseModel):
    title: Optional[str] = "New Conversation"

class ThreadResponse(BaseModel):
    id: str
    repository_id: str
    snapshot_id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)

class MessageResponse(BaseModel):
    id: str
    thread_id: str
    role: str
    content: str
    citations: List[Citation] = []
    uncertainties: List[str] = []
    suggested_questions: List[str] = []
    created_at: datetime

    class Config:
        from_attributes = True

class ThreadDetailResponse(ThreadResponse):
    messages: List[MessageResponse] = []
