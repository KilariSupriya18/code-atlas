import os
import time
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.database import AsyncSessionLocal, init_db
from apps.api.app.services.ingestion.indexer import IndexerService
from apps.api.app.services.retrieval.fusion import HybridRetriever
from apps.api.app.models.repository import Repository, Snapshot, IndexJob

@pytest.mark.asyncio
async def test_evaluation_benchmark():
    await init_db()
    async with AsyncSessionLocal() as session:
        # Create Demo Repo & Snapshot
        uid = uuid.uuid4().hex[:8]
        repo = Repository(
            id=f"eval-repo-{uid}",
            name="payment-auth-service",
            full_name=f"demo/eval-{uid}",
            url="https://github.com/demo/sample-repo",
            default_branch="main"
        )
        session.add(repo)

        snapshot = Snapshot(
            id=f"eval-snap-{uid}",
            repository_id=repo.id,
            commit_sha="eval-sha",
            branch="main",
            status="pending",
            embedding_model="BAAI/bge-small-en-v1.5",
            vector_dim=384
        )
        session.add(snapshot)

        job = IndexJob(
            id=f"eval-job-{uid}",
            repository_id=repo.id,
            snapshot_id=snapshot.id,
            stage="queued",
            progress_stats={}
        )
        session.add(job)
        await session.commit()

        # Run Real Ingestion Pipeline
        sample_path = os.path.abspath("demo/sample_repo")
        await IndexerService.run_pipeline(
            session=session,
            job_id=job.id,
            repo_id=repo.id,
            snapshot_id=snapshot.id,
            repo_url=repo.url,
            branch="main",
            local_override_path=sample_path
        )

        # Benchmark questions and expected symbols
        test_cases = [
            {
                "query": "Where is password hashing and authentication handled?",
                "expected_symbols": ["hash_password", "verify_password", "login_endpoint"]
            },
            {
                "query": "What happens when a payment fails or encounters an error?",
                "expected_symbols": ["execute_charge", "PaymentProcessingError", "_trigger_compensation_refund"]
            },
            {
                "query": "Where are database connections initialized?",
                "expected_symbols": ["DatabasePoolManager", "initialize_pool"]
            },
            {
                "query": "How is JWT token signature verified?",
                "expected_symbols": ["decode_and_verify_token", "create_access_token"]
            }
        ]

        print("\n--- RETRIEVAL EVALUATION BENCHMARK ---")
        for tc in test_cases:
            start_t = time.perf_counter()
            retrieved = await HybridRetriever.retrieve_context(
                session=session,
                snapshot_id=snapshot.id,
                query=tc["query"],
                top_k=5
            )
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0

            retrieved_symbols = [c.symbol_name for c in retrieved if c.symbol_name]
            # Verify that at least one expected symbol appears in the top retrieved results
            matched = any(exp in retrieved_symbols for exp in tc["expected_symbols"])
            print(f"Query: '{tc['query']}'")
            print(f"  Latency: {elapsed_ms:.2f}ms")
            print(f"  Top Symbols: {retrieved_symbols[:3]}")
            print(f"  Matched Expected: {matched}")
            assert matched, f"None of {tc['expected_symbols']} matched in {retrieved_symbols} for query: {tc['query']}"

        print("--- BENCHMARK PASSED ALL QUERIES ---\n")
