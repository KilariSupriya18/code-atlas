"""
Cryptographic password hashing and user credential verification logic.
Implements PBKDF2 with SHA-256 and constant-time comparison to prevent timing attacks.
"""
import hashlib
import hmac
import os
from typing import Tuple

SALT_BYTES = 16
HASH_ITERATIONS = 100_000

def hash_password(plain_password: str) -> str:
    """
    Hashes a plain-text password using PBKDF2-HMAC-SHA256 with a random salt.
    
    Args:
        plain_password: Plain-text string input from user registration or reset.
        
    Returns:
        Formatted string containing iterations, hex salt, and hex digest separated by '$'.
    """
    if not plain_password or len(plain_password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
        
    salt = os.urandom(SALT_BYTES)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        plain_password.encode('utf-8'),
        salt,
        HASH_ITERATIONS
    )
    return f"{HASH_ITERATIONS}${salt.hex()}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies that a plain-text password matches the stored salted PBKDF2 hash.
    Uses constant-time comparison to eliminate side-channel timing attacks.
    
    Args:
        plain_password: The plaintext candidate password.
        hashed_password: The stored composite hash string.
        
    Returns:
        True if password matches, False otherwise.
    """
    if not plain_password or not hashed_password:
        return False
        
    try:
        parts = hashed_password.split("$")
        if len(parts) != 3:
            return False
            
        iterations = int(parts[0])
        salt = bytes.fromhex(parts[1])
        expected_key = bytes.fromhex(parts[2])
        
        computed_key = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt,
            iterations
        )
        return hmac.compare_digest(computed_key, expected_key)
    except (ValueError, IndexError):
        return False
