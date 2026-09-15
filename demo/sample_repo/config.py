"""
Application configuration for PaymentAuth Core Service.
Manages environment variables, security constants, and database settings.
"""
import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    """Central configuration class containing immutable runtime parameters."""
    app_name: str = "PaymentAuth Core"
    environment: str = os.getenv("APP_ENV", "production")
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Security & Tokens
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "super-secret-dev-key-change-in-prod-32bytes")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    
    # Database
    db_pool_size: int = int(os.getenv("DB_POOL_SIZE", "20"))
    db_max_overflow: int = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    db_timeout_seconds: float = float(os.getenv("DB_TIMEOUT", "5.0"))
    
    # Payment Gateway Tolerances
    max_payment_retries: int = 3
    payment_timeout_seconds: float = 8.0

settings = Settings()
