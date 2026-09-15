import os
import uuid
import logging
from typing import Optional, Callable
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from apps.api.app.config import settings
from apps.api.app.models.repository import Repository, Snapshot, SourceFile, CodeChunk, IndexJob
from apps.api.app.services.ingestion.git_fetcher import GitFetcher
from apps.api.app.services.ingestion.parser import CodeParser
from apps.api.app.providers.embeddings import embedding_service
from apps.api.app.providers.vector_db import vector_db_service

logger = logging.getLogger(__name__)

class IndexerService:
    """
    Orchestrates the end-to-end ingestion pipeline:
    Git fetch -> Filter & Read -> Parse chunks -> Generate real embeddings -> Store in Qdrant & Postgres -> Activate snapshot.
    """

    @classmethod
    async def run_pipeline(
        cls,
        session: AsyncSession,
        job_id: str,
        repo_id: str,
        snapshot_id: str,
        repo_url: str,
        branch: str = "main",
        local_override_path: Optional[str] = None
    ):
        logger.info("Starting ingestion pipeline for repo_id=%s, snapshot_id=%s, job_id=%s", repo_id, snapshot_id, job_id)

        async def update_job_stage(stage: str, stats: dict = None, error: str = None):
            stmt = (
                update(IndexJob)
                .where(IndexJob.id == job_id)
                .values(
                    stage=stage,
                    progress_stats=stats or {},
                    error_message=error
                )
            )
            await session.execute(stmt)
            await session.commit()

        stats = {
            "files_discovered": 0,
            "files_parsed": 0,
            "symbols_extracted": 0,
            "chunks_created": 0,
            "chunks_embedded": 0,
            "current_file": None
        }

        try:
            # Stage 1: Fetching
            await update_job_stage("fetching", stats)
            
            if local_override_path and os.path.isdir(local_override_path):
                # Used for sample demo repository
                clone_path = local_override_path
                commit_sha = "demo-local-commit-sha-001"
                file_list = GitFetcher.collect_valid_files(clone_path)
            else:
                clone_path = os.path.join(settings.repo_storage_path, repo_id)
                commit_sha, file_list = GitFetcher.resolve_and_clone(
                    repo_url=repo_url,
                    target_dir=clone_path,
                    branch=branch
                )

            stats["files_discovered"] = len(file_list)
            await update_job_stage("fetching", stats)

            # Stage 2: Parsing
            await update_job_stage("parsing", stats)
            
            created_source_files = []
            all_chunks = []
            symbol_count = 0

            for rel_path in file_list:
                full_path = os.path.join(clone_path, rel_path)
                try:
                    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                except Exception as exc:
                    logger.warning("Could not read file %s: %s", full_path, exc)
                    continue

                stats["current_file"] = rel_path
                file_id = str(uuid.uuid4())
                source_file = SourceFile(
                    id=file_id,
                    snapshot_id=snapshot_id,
                    path=rel_path,
                    language="python" if rel_path.endswith(".py") else "markdown",
                    content=content,
                    size=len(content.encode("utf-8")),
                    commit_sha=commit_sha,
                    content_hash=CodeParser.compute_hash(content)
                )
                session.add(source_file)
                created_source_files.append(source_file)

                # Parse into semantic code chunks
                parsed = CodeParser.parse_file(content, rel_path)
                for p in parsed:
                    chunk_id = str(uuid.uuid4())
                    qdrant_point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{snapshot_id}_{chunk_id}"))
                    
                    if p.symbol_name:
                        symbol_count += 1

                    chunk_record = CodeChunk(
                        id=chunk_id,
                        snapshot_id=snapshot_id,
                        file_id=file_id,
                        file_path=rel_path,
                        language="python" if rel_path.endswith(".py") else "markdown",
                        chunk_type=p.chunk_type,
                        symbol_name=p.symbol_name,
                        parent_symbol=p.parent_symbol,
                        signature=p.signature,
                        docstring=p.docstring,
                        start_line=p.start_line,
                        end_line=p.end_line,
                        original_code=p.original_code,
                        content_hash=p.content_hash,
                        qdrant_point_id=qdrant_point_id
                    )
                    session.add(chunk_record)
                    all_chunks.append((chunk_record, p))

                stats["files_parsed"] += 1
                stats["symbols_extracted"] = symbol_count
                stats["chunks_created"] = len(all_chunks)

            await session.commit()
            await update_job_stage("parsing", stats)

            # Stage 3: Embedding
            await update_job_stage("embedding", stats)

            if all_chunks:
                # Prepare text representation for Sentence Transformers embedding
                embedding_texts = []
                for chunk, parsed in all_chunks:
                    header = f"File: {chunk.file_path}\n"
                    if chunk.symbol_name:
                        header += f"Symbol: {chunk.symbol_name}\n"
                    if chunk.signature:
                        header += f"Signature: {chunk.signature}\n"
                    if chunk.docstring:
                        header += f"Docstring: {chunk.docstring}\n"
                    text_to_embed = f"{header}\nCode:\n{chunk.original_code}"
                    embedding_texts.append(text_to_embed)

                batch_size = 32
                point_ids = []
                vectors = []
                payloads = []

                for i in range(0, len(embedding_texts), batch_size):
                    batch_texts = embedding_texts[i:i + batch_size]
                    batch_vectors = embedding_service.embed_texts(batch_texts)

                    for j, vec in enumerate(batch_vectors):
                        chunk_idx = i + j
                        chunk, _ = all_chunks[chunk_idx]
                        point_ids.append(chunk.qdrant_point_id)
                        vectors.append(vec)
                        payloads.append({
                            "chunk_id": chunk.id,
                            "snapshot_id": snapshot_id,
                            "repository_id": repo_id,
                            "file_path": chunk.file_path,
                            "symbol_name": chunk.symbol_name,
                            "chunk_type": chunk.chunk_type,
                            "start_line": chunk.start_line,
                            "end_line": chunk.end_line,
                            "signature": chunk.signature,
                        })

                    stats["chunks_embedded"] = min(i + batch_size, len(embedding_texts))
                    await update_job_stage("embedding", stats)

                # Upsert into Qdrant collection
                vector_db_service.upsert_chunks(point_ids, vectors, payloads)

            # Stage 4: Finalizing
            await update_job_stage("finalizing", stats)

            # Update snapshot record and activate
            snap_stmt = (
                update(Snapshot)
                .where(Snapshot.id == snapshot_id)
                .values(
                    commit_sha=commit_sha,
                    status="ready",
                    file_count=len(created_source_files),
                    symbol_count=symbol_count,
                    chunk_count=len(all_chunks)
                )
            )
            await session.execute(snap_stmt)

            # Set current_snapshot_id on repository
            repo_stmt = (
                update(Repository)
                .where(Repository.id == repo_id)
                .values(current_snapshot_id=snapshot_id)
            )
            await session.execute(repo_stmt)
            await session.commit()

            # Job is ready
            stats["current_file"] = None
            await update_job_stage("ready", stats)
            logger.info("Ingestion pipeline successfully completed for repository %s", repo_id)

        except Exception as exc:
            logger.error("Ingestion pipeline failed for repository %s: %s", repo_id, exc, exc_info=True)
            # Mark snapshot as failed
            await session.execute(
                update(Snapshot).where(Snapshot.id == snapshot_id).values(status="failed")
            )
            await update_job_stage("failed", stats, error=str(exc))
            raise
