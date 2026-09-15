import pytest
from apps.api.app.models.repository import CodeChunk
from apps.api.app.services.retrieval.lexical import LexicalRetriever

def test_bm25_and_exact_identifier_matching():
    chunk1 = CodeChunk(
        id="c1",
        snapshot_id="s1",
        file_id="f1",
        file_path="auth/security.py",
        language="python",
        chunk_type="function",
        symbol_name="verify_password",
        signature="def verify_password(plain, hashed)",
        docstring="Verifies hashed credentials",
        original_code="return hmac.compare_digest(plain, hashed)",
        content_hash="h1",
        qdrant_point_id="p1",
        start_line=1,
        end_line=10
    )

    chunk2 = CodeChunk(
        id="c2",
        snapshot_id="s1",
        file_id="f2",
        file_path="services/payment_service.py",
        language="python",
        chunk_type="method",
        symbol_name="execute_charge",
        signature="def execute_charge(payment_intent)",
        docstring="Executes charge with idempotency",
        original_code="if amount > balance: raise InsufficientFunds()",
        content_hash="h2",
        qdrant_point_id="p2",
        start_line=15,
        end_line=30
    )

    chunks = [chunk1, chunk2]

    # Query 1: Exact symbol search
    exact_hits = LexicalRetriever.find_exact_identifiers(chunks, "verify_password")
    assert len(exact_hits) > 0
    assert exact_hits[0]["chunk_id"] == "c1"

    # Query 2: Lexical BM25 search for payment failure
    bm25_hits = LexicalRetriever.rank_bm25(chunks, "insufficient funds balance charge")
    assert len(bm25_hits) > 0
    assert bm25_hits[0]["chunk_id"] == "c2"
