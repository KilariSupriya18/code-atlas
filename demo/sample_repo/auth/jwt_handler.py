"""
JWT token encoding, decoding, validation, and refresh lifecycle management.
Handles token issuance, HMAC-SHA256 signature verification, and revocation checking.
"""
import base64
import hashlib
import hmac
import json
import time
from typing import Any, Dict, Optional
from demo.sample_repo.config import settings

# In-memory revocation set simulating a Redis token blacklist
REVOKED_TOKENS = set()

def create_access_token(user_id: str, email: str, role: str = "member") -> str:
    """
    Creates a signed JWT access token with user claims and expiration timestamp.
    
    Args:
        user_id: Unique identifier for the authenticated user.
        email: Primary email address.
        role: Permission role (e.g., 'admin', 'member').
        
    Returns:
        Compact dot-separated JWT string (header.payload.signature).
    """
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + (settings.access_token_expire_minutes * 60)
    }
    
    encoded_header = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    
    signing_input = f"{encoded_header}.{encoded_payload}".encode()
    signature = hmac.new(
        settings.jwt_secret_key.encode(),
        signing_input,
        hashlib.sha256
    ).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    
    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"

def decode_and_verify_token(token: str) -> Dict[str, Any]:
    """
    Validates token signature, expiration, and checks against revoked token registry.
    
    Args:
        token: Raw JWT string.
        
    Returns:
        Dictionary of claims contained in the decoded payload.
        
    Raises:
        ValueError: If token format is invalid, signature verification fails, or token expired.
        PermissionError: If token has been explicitly revoked.
    """
    if token in REVOKED_TOKENS:
        raise PermissionError("Token has been revoked.")
        
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed token format.")
        
    encoded_header, encoded_payload, encoded_signature = parts
    
    # Recompute expected signature
    signing_input = f"{encoded_header}.{encoded_payload}".encode()
    expected_signature = hmac.new(
        settings.jwt_secret_key.encode(),
        signing_input,
        hashlib.sha256
    ).digest()
    expected_encoded = base64.urlsafe_b64encode(expected_signature).decode().rstrip("=")
    
    if not hmac.compare_digest(encoded_signature, expected_encoded):
        raise ValueError("Invalid token signature.")
        
    # Pad base64 payload if needed
    padding = len(encoded_payload) % 4
    if padding:
        encoded_payload += "=" * (4 - padding)
        
    payload_json = base64.urlsafe_b64decode(encoded_payload.encode()).decode()
    payload = json.loads(payload_json)
    
    if payload.get("exp", 0) < time.time():
        raise ValueError("Token has expired.")
        
    return payload

def revoke_token(token: str) -> None:
    """Adds a token to the revocation blacklist upon logout or security events."""
    REVOKED_TOKENS.add(token)
