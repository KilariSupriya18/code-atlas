import os
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
from groq import AsyncGroq
from apps.api.app.config import settings
from apps.api.app.providers.groq_client import groq_service

router = APIRouter(prefix="/api/settings", tags=["Settings"])

class GroqKeyUpdate(BaseModel):
    api_key: str = Field(..., min_length=1)

@router.get("")
async def get_settings():
    masked_key = None
    if settings.groq_api_key:
        k = settings.groq_api_key.strip()
        masked_key = f"{k[:4]}...{k[-4:]}" if len(k) > 8 else "***"

    return {
        "groq": {
            "configured": groq_service.is_configured(),
            "masked_key": masked_key,
            "model": settings.groq_model,
            "fallback_model": settings.groq_fallback_model
        },
        "embeddings": {
            "model": settings.embedding_model,
            "dimensions": settings.embedding_dimensions,
            "max_seq_length": settings.embedding_max_seq_length
        },
        "storage": {
            "vector_path": settings.qdrant_path,
            "repo_path": settings.repo_storage_path,
            "database_url": settings.database_url.split("@")[-1]  # Hide user/pass if present
        }
    }

@router.post("/groq-key")
async def update_groq_key(payload: GroqKeyUpdate):
    key = payload.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    # Verify key against Groq models endpoint
    try:
        test_client = AsyncGroq(api_key=key)
        models_res = await test_client.models.list()
        available_model_ids = [m.id for m in models_res.data]
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to authenticate with Groq API using provided key: {str(exc)}"
        )

    # Update runtime settings and provider client
    settings.groq_api_key = key
    groq_service._client = None  # Force re-instantiation

    # Persist to .env file so it stays saved
    try:
        env_path = ".env"
        lines = []
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        
        found = False
        new_lines = []
        for line in lines:
            if line.startswith("GROQ_API_KEY="):
                new_lines.append(f"GROQ_API_KEY={key}\n")
                found = True
            else:
                new_lines.append(line)
        if not found:
            new_lines.append(f"GROQ_API_KEY={key}\n")
            
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception:
        pass

    return {
        "status": "success",
        "message": "Groq API key validated and activated successfully.",
        "models_available": len(available_model_ids)
    }
