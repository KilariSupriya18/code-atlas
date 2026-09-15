import pytest
from apps.api.app.models.repository import CodeChunk
from apps.api.app.services.retrieval.citation import CitationValidator

def test_citation_validator_validates_and_rejects_hallucinations():
    c1 = CodeChunk(
        id="chunk-auth-01",
        snapshot_id="snap-1",
        file_id="f1",
        file_path="auth/jwt_handler.py",
        language="python",
        chunk_type="function",
        symbol_name="decode_and_verify_token",
        start_line=20,
        end_line=45,
        original_code="def decode_and_verify_token(token): pass",
        content_hash="h1",
        qdrant_point_id="p1"
    )

    available_chunks = [c1]

    # Valid citation with chunk ID
    valid_input = [
        {"chunk_id": "chunk-auth-01", "claim": "Validates signature"}
    ]
    resolved = CitationValidator.validate_and_resolve(valid_input, available_chunks)
    assert len(resolved) == 1
    assert resolved[0].file_path == "auth/jwt_handler.py"
    assert resolved[0].symbol_name == "decode_and_verify_token"
    assert resolved[0].start_line == 20

    # Hallucinated citation with nonexistent chunk ID
    fake_input = [
        {"chunk_id": "nonexistent-chunk-999", "claim": "Fabricated logic"}
    ]
    resolved_fake = CitationValidator.validate_and_resolve(fake_input, available_chunks)
    # Hallucinated ID is rejected and safely fallbacks to legitimate available context
    assert len(resolved_fake) == 1
    assert resolved_fake[0].file_path == "auth/jwt_handler.py"
