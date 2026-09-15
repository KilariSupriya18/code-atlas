import asyncio
import logging
from typing import Optional
from apps.api.app.database import AsyncSessionLocal
from apps.api.app.services.ingestion.indexer import IndexerService

logger = logging.getLogger(__name__)

class JobWorker:
    """
    Background worker executing repository ingestion jobs.
    Supports asynchronous in-process queue execution as well as external workers.
    """

    @classmethod
    def enqueue_job(
        cls,
        job_id: str,
        repo_id: str,
        snapshot_id: str,
        repo_url: str,
        branch: str = "main",
        local_override_path: Optional[str] = None
    ):
        """Enqueues job as an asynchronous background task."""
        asyncio.create_task(
            cls._execute_job(
                job_id=job_id,
                repo_id=repo_id,
                snapshot_id=snapshot_id,
                repo_url=repo_url,
                branch=branch,
                local_override_path=local_override_path
            )
        )

    @classmethod
    async def _execute_job(
        cls,
        job_id: str,
        repo_id: str,
        snapshot_id: str,
        repo_url: str,
        branch: str,
        local_override_path: Optional[str]
    ):
        async with AsyncSessionLocal() as session:
            try:
                await IndexerService.run_pipeline(
                    session=session,
                    job_id=job_id,
                    repo_id=repo_id,
                    snapshot_id=snapshot_id,
                    repo_url=repo_url,
                    branch=branch,
                    local_override_path=local_override_path
                )
            except Exception as exc:
                logger.error("Job %s execution failed: %s", job_id, exc)

job_worker = JobWorker()
