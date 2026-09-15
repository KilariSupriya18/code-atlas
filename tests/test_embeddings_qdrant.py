import pytest
import numpy as np
from apps.api.app.providers.embeddings import embedding_service
from apps.api.app.providers.vector_db import vector_db_service

def test_sentence_transformers_embedding():
    texts = ["def hash_password(plain_password): return salt", "def authenticate_user(): pass"]
    vectors = embedding_service.embed_texts(texts)
    
    assert len(vectors) == 2
    assert len(vectors[0]) == 384
    # Check L2 normalization (norm should be ~1.0)
    norm = np.linalg.norm(vectors[0])
    assert abs(norm - 1.0) < 1e-4

import uuid

def test_qdrant_embedded_upsert_and_search():
    point_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
    vectors = [
        [0.1] * 384,
        [0.2] * 384
    ]
    # Normalize for cosine distance
    vectors[0] = (np.array(vectors[0]) / np.linalg.norm(vectors[0])).tolist()
    vectors[1] = (np.array(vectors[1]) / np.linalg.norm(vectors[1])).tolist()

    payloads = [
        {"chunk_id": "c1", "snapshot_id": "snap-test-1", "symbol_name": "login"},
        {"chunk_id": "c2", "snapshot_id": "snap-test-2", "symbol_name": "logout"}
    ]

    vector_db_service.upsert_chunks(point_ids, vectors, payloads)

    # Search filtered by snapshot_id snap-test-1
    results = vector_db_service.search_dense(
        snapshot_id="snap-test-1",
        query_vector=vectors[0],
        limit=5
    )

    assert len(results) >= 1
    assert results[0]["payload"]["snapshot_id"] == "snap-test-1"
    assert results[0]["payload"]["symbol_name"] == "login"
