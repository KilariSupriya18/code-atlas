import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apps.api.app.config import settings
from apps.api.app.database import init_db
from apps.api.app.routes import health, repositories, jobs, chat, learning, settings as app_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("codeatlas")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing CodeAtlas backend...")
    await init_db()
    logger.info("Database schemas initialized.")
    yield
    logger.info("Shutting down CodeAtlas backend.")

app = FastAPI(
    title="CodeAtlas API",
    description="Codebase RAG & Adaptive Onboarding Platform API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(repositories.router)
app.include_router(jobs.router)
app.include_router(chat.router)
app.include_router(learning.router)
app.include_router(app_settings.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.api.app.main:app", host="0.0.0.0", port=8000, reload=True)
