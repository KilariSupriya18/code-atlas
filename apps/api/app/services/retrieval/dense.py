import logging
from typing import List, Dict, Any
from apps.api.app.providers.embeddings import embedding_service
from apps.api.app.providers.vector_db import vector_db_service

logger = logging.getLogger(__name__)

class DenseRetriever:
    """Performs semantic vector search against Qdrant scoped to a snapshot."""

    @classmethod
    def retrieve(cls, snapshot_id: str, query: str, limit: int = 15) -> List[Dict[str, Any]]:
        query_vector = embedding_service.embed_query(query)
        results = vector_db_service.search_dense(snapshot_id, query_vector, limit=limit)
        
        dense_hits = []
        for idx, item in enumerate(results):
            payload = item.get("payload", {})
            chunk_id = payload.get("chunk_id")
            if chunk_id:
                dense_hits.append({
                    "chunk_id": chunk_id,
                    "score": item.get("score", 0.0),
                    "rank": idx + 1,
                    "payload": payload
                })
        return dense_hits
