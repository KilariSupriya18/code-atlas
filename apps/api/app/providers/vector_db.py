import os
import logging
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest_models
from apps.api.app.config import settings

logger = logging.getLogger(__name__)

class VectorDBService:
    """
    Manages Qdrant vector database interactions.
    Operates in embedded persistent mode (local disk) or connects to remote Qdrant container/cloud.
    """

    def __init__(self):
        self._client: Optional[QdrantClient] = None
        self.collection_name = f"{settings.qdrant_collection_prefix}_chunks"
        self.dimensions = settings.embedding_dimensions

    def get_client(self) -> QdrantClient:
        if self._client is None:
            if settings.qdrant_url:
                logger.info("Connecting to remote Qdrant at %s", settings.qdrant_url)
                self._client = QdrantClient(
                    url=settings.qdrant_url,
                    api_key=settings.qdrant_api_key
                )
            else:
                os.makedirs(settings.qdrant_path, exist_ok=True)
                logger.info("Initializing embedded persistent Qdrant at %s", settings.qdrant_path)
                self._client = QdrantClient(path=settings.qdrant_path)
            
            self._ensure_collection()
        return self._client

    def _ensure_collection(self):
        client = self._client
        if client is None:
            return
        
        collections = client.get_collections().collections
        exists = any(c.name == self.collection_name for c in collections)
        
        if not exists:
            logger.info("Creating Qdrant collection '%s' (dim: %d, distance: Cosine)...", self.collection_name, self.dimensions)
            client.create_collection(
                collection_name=self.collection_name,
                vectors_config=rest_models.VectorParams(
                    size=self.dimensions,
                    distance=rest_models.Distance.COSINE
                )
            )
            # Create payload index for fast snapshot filtering
            client.create_payload_index(
                collection_name=self.collection_name,
                field_name="snapshot_id",
                field_schema=rest_models.PayloadSchemaType.KEYWORD
            )

    def upsert_chunks(
        self,
        point_ids: List[str],
        vectors: List[List[float]],
        payloads: List[Dict[str, Any]]
    ):
        """Batch upserts points into Qdrant collection."""
        if not point_ids:
            return
        
        client = self.get_client()
        points = [
            rest_models.PointStruct(
                id=pid,
                vector=vec,
                payload=pay
            )
            for pid, vec, pay in zip(point_ids, vectors, payloads)
        ]
        
        client.upsert(
            collection_name=self.collection_name,
            points=points,
            wait=True
        )

    def search_dense(
        self,
        snapshot_id: str,
        query_vector: List[float],
        limit: int = 15
    ) -> List[Dict[str, Any]]:
        """
        Retrieves closest vector chunks filtered strictly by snapshot_id.
        """
        client = self.get_client()
        
        filter_condition = rest_models.Filter(
            must=[
                rest_models.FieldCondition(
                    key="snapshot_id",
                    match=rest_models.MatchValue(value=snapshot_id)
                )
            ]
        )
        
        # Support both qdrant-client search and query_points
        try:
            results = client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=filter_condition,
                limit=limit
            )
            return [
                {
                    "point_id": hit.id,
                    "score": float(hit.score),
                    "payload": hit.payload or {}
                }
                for hit in results
            ]
        except AttributeError:
            # Newer qdrant-client query_points
            query_res = client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                query_filter=filter_condition,
                limit=limit
            )
            return [
                {
                    "point_id": hit.id,
                    "score": float(hit.score),
                    "payload": hit.payload or {}
                }
                for hit in query_res.points
            ]

# Singleton vector DB service
vector_db_service = VectorDBService()
