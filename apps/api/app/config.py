import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # LLM Provider (Groq)
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    groq_fallback_model: Optional[str] = "openai/gpt-oss-20b"
    
    # Embeddings (Local Sentence Transformers)
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dimensions: int = 384
    embedding_max_seq_length: int = 512
    
    # Vector Database
    qdrant_url: Optional[str] = None
    qdrant_api_key: Optional[str] = None
    qdrant_path: str = "./data/qdrant"
    qdrant_collection_prefix: str = "codementor"
    
    # Relational Database
    database_url: str = "sqlite+aiosqlite:///./data/codementor.db"
    
    # Cache & Worker
    redis_url: str = "redis://localhost:6379/0"
    
    # Ingestion Storage
    repo_storage_path: str = "./data/repos"
    max_repo_size_mb: int = 250
    max_file_size_kb: int = 500
    git_clone_timeout_seconds: int = 60
    
    # Web / CORS
    frontend_origin: str = "http://localhost:5173"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

settings = Settings()
