from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, HttpUrl

class RepositoryCreate(BaseModel):
    url: str = Field(..., description="HTTPS GitHub repository URL")
    branch: Optional[str] = Field("main", description="Target branch (optional, defaults to main)")

class RepositoryResponse(BaseModel):
    id: str
    name: str
    full_name: str
    url: str
    default_branch: str
    current_snapshot_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SnapshotResponse(BaseModel):
    id: str
    repository_id: str
    commit_sha: str
    branch: str
    status: str
    file_count: int
    symbol_count: int
    chunk_count: int
    embedding_model: str
    vector_dim: int
    created_at: datetime

    class Config:
        from_attributes = True

class JobProgressStats(BaseModel):
    files_discovered: int = 0
    files_parsed: int = 0
    symbols_extracted: int = 0
    chunks_created: int = 0
    chunks_embedded: int = 0
    current_file: Optional[str] = None

class JobResponse(BaseModel):
    id: str
    repository_id: str
    snapshot_id: str
    stage: str
    progress_stats: Dict[str, Any]
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SourceFileSummary(BaseModel):
    id: str
    path: str
    language: str
    size: int
    commit_sha: str

class SourceFileDetail(BaseModel):
    id: str
    path: str
    language: str
    content: str
    size: int
    commit_sha: str

class CodeChunkResponse(BaseModel):
    id: str
    snapshot_id: str
    file_path: str
    language: str
    chunk_type: str
    symbol_name: Optional[str] = None
    parent_symbol: Optional[str] = None
    signature: Optional[str] = None
    docstring: Optional[str] = None
    start_line: int
    end_line: int
    original_code: str
    content_hash: str

    class Config:
        from_attributes = True
