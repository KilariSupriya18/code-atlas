"""
Authentication routing endpoints: login, token renewal, and current user retrieval.
Integrates password verification and JWT token lifecycle management.
"""
from typing import Dict, Optional
from demo.sample_repo.auth.security import verify_password
from demo.sample_repo.auth.jwt_handler import create_access_token, decode_and_verify_token, revoke_token

# Mock user repository for demonstration
MOCK_USERS_DB = {
    "dev@example.com": {
        "id": "usr_99812",
        "email": "dev@example.com",
        "hashed_pwd": "100000$a1b2c3d4e5f60718293a4b5c6d7e8f90$5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
        "role": "lead_engineer",
        "is_active": True
    }
}

async def login_endpoint(credentials: Dict[str, str]) -> Dict[str, str]:
    """
    Authenticates user credentials and returns JWT access and refresh tokens.
    
    Args:
        credentials: Dict containing 'email' and 'password'.
        
    Returns:
        Dict with 'access_token', 'token_type', and 'user_id'.
        
    Raises:
        PermissionError: If user is not found, inactive, or password does not match.
    """
    email = credentials.get("email", "").lower().strip()
    password = credentials.get("password", "")
    
    user = MOCK_USERS_DB.get(email)
    if not user:
        raise PermissionError("Invalid email or password.")
        
    if not user.get("is_active"):
        raise PermissionError("User account is disabled.")
        
    if not verify_password(password, user["hashed_pwd"]):
        raise PermissionError("Invalid email or password.")
        
    access_token = create_access_token(user_id=user["id"], email=user["email"], role=user["role"])
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["id"]
    }

async def refresh_token_endpoint(authorization_header: str) -> Dict[str, str]:
    """
    Validates current token and issues a freshly signed token.
    Rotates old token to prevent replay attacks.
    """
    if not authorization_header or not authorization_header.startswith("Bearer "):
        raise ValueError("Missing or invalid Bearer authentication header.")
        
    token = authorization_header[7:]
    claims = decode_and_verify_token(token)
    
    # Revoke previous token during rotation
    revoke_token(token)
    
    new_token = create_access_token(
        user_id=claims["sub"],
        email=claims["email"],
        role=claims.get("role", "member")
    )
    return {"access_token": new_token, "token_type": "bearer"}

async def get_current_user_profile(token: str) -> Dict[str, str]:
    """
    Protected endpoint helper extracting identity from verified authorization token.
    """
    claims = decode_and_verify_token(token)
    return {
        "user_id": claims["sub"],
        "email": claims["email"],
        "role": claims.get("role", "member")
    }
