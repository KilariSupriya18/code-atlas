from fastapi import APIRouter
from apps.api.app.config import settings
from apps.api.app.providers.groq_client import groq_service

router = APIRouter(tags=["Health & Capabilities"])

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "codeatlas-api",
        "version": "1.0.0"
    }

@router.get("/api/capabilities")
async def get_capabilities():
    return {
        "groq": {
            "configured": groq_service.is_configured(),
            "model": settings.groq_model,
            "fallback_model": settings.groq_fallback_model
        },
        "embeddings": {
            "model": settings.embedding_model,
            "dimensions": settings.embedding_dimensions,
            "max_seq_length": settings.embedding_max_seq_length,
            "mode": "local-sentence-transformers"
        },
        "vector_db": {
            "type": "qdrant",
            "mode": "remote" if settings.qdrant_url else "embedded-persistent",
            "path": settings.qdrant_path
        },
        "database": {
            "dialect": settings.database_url.split("+")[0].split(":")[0]
        }
    }
