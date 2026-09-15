# PaymentAuth Core Service

A production-grade Python service handling user authentication, JWT session lifecycle, database connection pooling, and resilient payment transaction processing.

## Architecture Overview

- **Auth Layer (`auth/`)**:
  - `security.py`: Password hashing with PBKDF2/SHA256, constant-time verification, and user credential validation.
  - `jwt_handler.py`: Asymmetric and symmetric HMAC token encoding, refresh token rotation, revocation tracking, and signature verification.
  - `routes.py`: FastAPI routes for `/api/v1/auth/login`, `/api/v1/auth/refresh`, and protected endpoint `/api/v1/users/me`.
- **Service Layer (`services/`)**:
  - `payment_service.py`: Payment transaction processing, balance verification, idempotent gateway interaction, fraud detection heuristics, and structured error/failure branching.
- **Database Layer (`database/`)**:
  - `connection.py`: Asynchronous connection pool management, health-check probes, and transactional session context managers.
- **Configuration (`config.py`)**:
  - Centralized application settings, token expiry intervals, database connection string, and retry tolerances.
