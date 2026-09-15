import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from apps.api.app.models.repository import CodeChunk
from apps.api.app.services.retrieval.dense import DenseRetriever
from apps.api.app.services.retrieval.lexical import LexicalRetriever

logger = logging.getLogger(__name__)

class HybridRetriever:
    """
    Combines dense semantic search (Qdrant), BM25 lexical ranking, and exact symbol matching
    using Reciprocal Rank Fusion (RRF) with deduplication and bounded contextual selection.
    """

    K_RRF = 60
    WEIGHT_DENSE = 1.0
    WEIGHT_BM25 = 0.8
    WEIGHT_EXACT = 1.2

    @classmethod
    async def retrieve_context(
        cls,
        session: AsyncSession,
        snapshot_id: str,
        query: str,
        top_k: int = 8
    ) -> List[CodeChunk]:
        """
        Executes snapshot-scoped hybrid retrieval and returns the top_k most relevant CodeChunks.
        """
        # Fetch all candidate chunks for this snapshot to support in-memory BM25 & exact matching
        stmt = select(CodeChunk).where(CodeChunk.snapshot_id == snapshot_id)
        result = await session.execute(stmt)
        all_chunks: List[CodeChunk] = list(result.scalars().all())

        if not all_chunks:
            return []

        chunk_by_id = {c.id: c for c in all_chunks}

        # 1. Dense Qdrant retrieval
        dense_hits = []
        try:
            dense_hits = DenseRetriever.retrieve(snapshot_id=snapshot_id, query=query, limit=20)
        except Exception as exc:
            logger.warning("Dense retrieval error: %s", exc)

        # 2. BM25 lexical ranking
        bm25_hits = LexicalRetriever.rank_bm25(all_chunks, query, limit=20)

        # 3. Exact identifier matching
        exact_hits = LexicalRetriever.find_exact_identifiers(all_chunks, query)

        # 4. Reciprocal Rank Fusion
        rrf_scores: Dict[str, float] = {}

        for hit in dense_hits:
            cid = hit["chunk_id"]
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (cls.WEIGHT_DENSE / (cls.K_RRF + hit["rank"]))

        for hit in bm25_hits:
            cid = hit["chunk_id"]
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (cls.WEIGHT_BM25 / (cls.K_RRF + hit["rank"]))

        for hit in exact_hits:
            cid = hit["chunk_id"]
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (cls.WEIGHT_EXACT / (cls.K_RRF + hit["rank"]))

        # Sort by combined RRF score
        sorted_chunk_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)

        selected_chunks: List[CodeChunk] = []
        seen_files_count: Dict[str, int] = {}

        # Prioritize diverse, high-ranking chunks within budget
        for cid in sorted_chunk_ids:
            chunk = chunk_by_id.get(cid)
            if not chunk:
                continue

            # Diversity heuristic: don't let a single file consume more than 3 chunks in top selection
            file_count = seen_files_count.get(chunk.file_path, 0)
            if file_count >= 3 and len(selected_chunks) < (top_k - 1):
                continue

            selected_chunks.append(chunk)
            seen_files_count[chunk.file_path] = file_count + 1

            if len(selected_chunks) >= top_k:
                break

        # If question is broad architecture/overview and no README or config is in selection, inject top readme
        is_broad = any(w in query.lower() for w in ["architecture", "overview", "structure", "how does", "what is"])
        if is_broad and not any(c.chunk_type in {"readme", "config"} for c in selected_chunks):
            for c in all_chunks:
                if c.chunk_type == "readme":
                    selected_chunks.insert(0, c)
                    if len(selected_chunks) > top_k:
                        selected_chunks.pop()
                    break

        return selected_chunks
