import pytest
from apps.api.app.services.ingestion.parser import CodeParser

SAMPLE_PYTHON_CODE = '''"""Module docstring."""
import os

def hash_password(plain_password: str) -> str:
    """Hashes a password with salt."""
    return "hashed"

class SecurityManager:
    """Manages credentials."""
    def __init__(self, key: str):
        self.key = key

    async def verify_token(self, token: str) -> bool:
        """Verifies JWT signature."""
        return True
'''

def test_code_parser_extracts_functions_and_classes():
    chunks = CodeParser.parse_python(SAMPLE_PYTHON_CODE, "auth/security.py")
    
    symbol_names = [c.symbol_name for c in chunks]
    assert "hash_password" in symbol_names
    assert "SecurityManager" in symbol_names
    assert "verify_token" in symbol_names

    # Check function details
    hash_fn = next(c for c in chunks if c.symbol_name == "hash_password")
    assert hash_fn.chunk_type == "function"
    assert hash_fn.start_line == 4
    assert hash_fn.end_line == 6
    assert "Hashes a password with salt." in (hash_fn.docstring or "")
    assert "def hash_password(plain_password: str) -> str" in (hash_fn.signature or "")

    # Check method details
    verify_m = next(c for c in chunks if c.symbol_name == "verify_token")
    assert verify_m.chunk_type == "async_function"
    assert verify_m.parent_symbol == "SecurityManager"
    assert "async def verify_token(self, token: str) -> bool" in (verify_m.signature or "")

def test_code_parser_markdown():
    sample_md = """# Overview
This is system overview.

## Architecture
Details of the service layer.
"""
    chunks = CodeParser.parse_markdown(sample_md, "README.md")
    assert len(chunks) == 2
    assert chunks[0].symbol_name == "Overview"
    assert chunks[1].symbol_name == "Architecture"
