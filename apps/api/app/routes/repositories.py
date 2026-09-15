import os
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from apps.api.app.database import get_db
from apps.api.app.models.repository import Repository, Snapshot, SourceFile, CodeChunk, IndexJob
from apps.api.app.models.learning import UserProgress
from apps.api.app.schemas.repository import (
    RepositoryCreate, RepositoryResponse, SnapshotResponse,
    SourceFileSummary, SourceFileDetail
)
from apps.api.app.schemas.learning import ProgressResponse
from apps.api.app.services.ingestion.git_fetcher import GitFetcher
from apps.api.app.workers.job_worker import job_worker
from apps.api.app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/repositories", tags=["Repositories"])

@router.post("", response_model=dict)
async def create_repository(payload: RepositoryCreate, db: AsyncSession = Depends(get_db)):
    url = payload.url.strip()
    is_demo = "demo" in url.lower() or "sample" in url.lower()

    if not is_demo and not GitFetcher.validate_repo_url(url):
        raise HTTPException(
            status_code=400,
            detail="Invalid repository URL. Only public HTTPS GitHub repositories (https://github.com/owner/repo) are supported."
        )

    # Derive name
    if is_demo:
        repo_name = "payment-auth-service"
        full_name = "demo/payment-auth-service"
        demo_path = os.path.abspath("demo/sample_repo")
    else:
        parts = url.rstrip("/").split("/")
        repo_name = parts[-1].replace(".git", "")
        owner = parts[-2]
        full_name = f"{owner}/{repo_name}"
        demo_path = None

    # Check if repo already exists
    stmt = select(Repository).where(Repository.full_name == full_name)
    res = await db.execute(stmt)
    existing_repo = res.scalars().first()

    if existing_repo:
        repo_id = existing_repo.id
    else:
        repo_id = str(uuid.uuid4())
        repo = Repository(
            id=repo_id,
            name=repo_name,
            full_name=full_name,
            url=url,
            default_branch=payload.branch or "main"
        )
        db.add(repo)
        await db.commit()

    # Create Snapshot
    snapshot_id = str(uuid.uuid4())
    snapshot = Snapshot(
        id=snapshot_id,
        repository_id=repo_id,
        commit_sha="pending",
        branch=payload.branch or "main",
        status="pending",
        embedding_model=settings.embedding_model,
        vector_dim=settings.embedding_dimensions
    )
    db.add(snapshot)

    # Create IndexJob
    job_id = str(uuid.uuid4())
    job = IndexJob(
        id=job_id,
        repository_id=repo_id,
        snapshot_id=snapshot_id,
        stage="queued",
        progress_stats={
            "files_discovered": 0,
            "files_parsed": 0,
            "symbols_extracted": 0,
            "chunks_created": 0,
            "chunks_embedded": 0
        }
    )
    db.add(job)
    await db.commit()

    # Launch background indexing job
    job_worker.enqueue_job(
        job_id=job_id,
        repo_id=repo_id,
        snapshot_id=snapshot_id,
        repo_url=url,
        branch=payload.branch or "main",
        local_override_path=demo_path
    )

    return {
        "repository_id": repo_id,
        "snapshot_id": snapshot_id,
        "job_id": job_id,
        "status": "queued"
    }

@router.get("", response_model=List[RepositoryResponse])
async def list_repositories(db: AsyncSession = Depends(get_db)):
    stmt = select(Repository).order_by(Repository.updated_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())

@router.get("/{repo_id}")
async def get_repository(repo_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Repository).where(Repository.id == repo_id)
    res = await db.execute(stmt)
    repo = res.scalars().first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    snapshot = None
    if repo.current_snapshot_id:
        s_stmt = select(Snapshot).where(Snapshot.id == repo.current_snapshot_id)
        s_res = await db.execute(s_stmt)
        snapshot = s_res.scalars().first()

    return {
        "repository": RepositoryResponse.model_validate(repo),
        "current_snapshot": SnapshotResponse.model_validate(snapshot) if snapshot else None
    }

@router.post("/{repo_id}/reindex")
async def reindex_repository(repo_id: str, branch: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    stmt = select(Repository).where(Repository.id == repo_id)
    res = await db.execute(stmt)
    repo = res.scalars().first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    target_branch = branch or repo.default_branch or "main"
    demo_path = os.path.abspath("demo/sample_repo") if "demo" in repo.full_name else None

    snapshot_id = str(uuid.uuid4())
    snapshot = Snapshot(
        id=snapshot_id,
        repository_id=repo.id,
        commit_sha="pending",
        branch=target_branch,
        status="pending",
        embedding_model=settings.embedding_model,
        vector_dim=settings.embedding_dimensions
    )
    db.add(snapshot)

    job_id = str(uuid.uuid4())
    job = IndexJob(
        id=job_id,
        repository_id=repo.id,
        snapshot_id=snapshot_id,
        stage="queued",
        progress_stats={}
    )
    db.add(job)
    await db.commit()

    job_worker.enqueue_job(
        job_id=job_id,
        repo_id=repo.id,
        snapshot_id=snapshot_id,
        repo_url=repo.url,
        branch=target_branch,
        local_override_path=demo_path
    )

    return {"job_id": job_id, "snapshot_id": snapshot_id}

@router.get("/{repo_id}/files", response_model=List[SourceFileSummary])
async def list_repository_files(repo_id: str, db: AsyncSession = Depends(get_db)):
    repo_stmt = select(Repository).where(Repository.id == repo_id)
    repo_res = await db.execute(repo_stmt)
    repo = repo_res.scalars().first()
    if not repo or not repo.current_snapshot_id:
        return []

    stmt = select(SourceFile).where(SourceFile.snapshot_id == repo.current_snapshot_id).order_by(SourceFile.path)
    res = await db.execute(stmt)
    files = res.scalars().all()
    return [
        SourceFileSummary(
            id=f.id,
            path=f.path,
            language=f.language,
            size=f.size,
            commit_sha=f.commit_sha
        )
        for f in files
    ]

@router.get("/{repo_id}/source", response_model=SourceFileDetail)
async def get_repository_source(
    repo_id: str,
    path: str = Query(..., description="Relative file path"),
    db: AsyncSession = Depends(get_db)
):
    repo_stmt = select(Repository).where(Repository.id == repo_id)
    repo_res = await db.execute(repo_stmt)
    repo = repo_res.scalars().first()
    if not repo or not repo.current_snapshot_id:
        raise HTTPException(status_code=404, detail="Repository or active snapshot not found")

    # Strictly fetch from database records - no direct arbitrary filesystem access
    stmt = (
        select(SourceFile)
        .where(
            SourceFile.snapshot_id == repo.current_snapshot_id,
            SourceFile.path == path
        )
    )
    res = await db.execute(stmt)
    file_record = res.scalars().first()
    if not file_record:
        raise HTTPException(status_code=404, detail=f"File '{path}' not found in active snapshot")

    return SourceFileDetail(
        id=file_record.id,
        path=file_record.path,
        language=file_record.language,
        content=file_record.content,
        size=file_record.size,
        commit_sha=file_record.commit_sha
    )

@router.get("/{repo_id}/progress", response_model=ProgressResponse)
async def get_repository_progress(repo_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(UserProgress).where(UserProgress.repository_id == repo_id)
    res = await db.execute(stmt)
    prog = res.scalars().first()
    if not prog:
        return ProgressResponse(
            repository_id=repo_id,
            lessons_visited=[],
            topics_practiced=[],
            exercise_outcomes={},
            concepts_to_revisit=[],
            total_lessons=0,
            demonstrated_count=0,
            updated_at=datetime.now(timezone.utc)
        )

    outcomes = prog.exercise_outcomes or {}
    return ProgressResponse(
        repository_id=repo_id,
        lessons_visited=prog.lessons_visited or [],
        topics_practiced=prog.topics_practiced or [],
        exercise_outcomes=outcomes,
        concepts_to_revisit=prog.concepts_to_revisit or [],
        total_lessons=len(prog.lessons_visited or []),
        demonstrated_count=outcomes.get("correct", 0),
        updated_at=prog.updated_at
    )
