"""
Authentication API router with login endpoint and rate limiting.
Rate limiting: max 5 login attempts per IP per 60-second sliding window.
"""
import time
from collections import defaultdict
from threading import Lock
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt

from app.config import settings
from app.database.session import get_db
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Rate Limiting (in-memory sliding window) ──────────────────────────
RATE_LIMIT_MAX_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SECONDS = 60

_rate_limit_store: dict[str, list[float]] = defaultdict(list)
_rate_limit_lock = Lock()


def _check_rate_limit(client_ip: str) -> tuple[bool, int]:
    """
    Returns (is_allowed, retry_after_seconds).
    Uses a sliding window to track attempts per IP.
    """
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS

    with _rate_limit_lock:
        # Clean up old entries
        _rate_limit_store[client_ip] = [
            t for t in _rate_limit_store[client_ip] if t > window_start
        ]

        attempts = _rate_limit_store[client_ip]

        if len(attempts) >= RATE_LIMIT_MAX_ATTEMPTS:
            # Calculate when the oldest attempt in the window will expire
            oldest = attempts[0]
            retry_after = int((oldest + RATE_LIMIT_WINDOW_SECONDS) - now) + 1
            return False, max(retry_after, 1)

        # Record this attempt
        _rate_limit_store[client_ip].append(now)
        return True, 0


# ── Schemas ───────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_name: str
    user_email: str
    expires_in: int  # seconds


class ErrorResponse(BaseModel):
    detail: str


# ── Helper: Create JWT ────────────────────────────────────────────────
def _create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ── Login Endpoint ────────────────────────────────────────────────────
@router.post(
    "/login",
    response_model=LoginResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid credentials"},
        429: {"model": ErrorResponse, "description": "Too many login attempts"},
    },
)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a user with email and password.
    Returns a JWT access token on success.
    Rate limited to 5 attempts per IP per 60 seconds.
    """
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"

    # Check rate limit
    is_allowed, retry_after = _check_rate_limit(client_ip)
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    # Look up user
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()

    if not user or not pwd_context.verify(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    # Generate JWT token
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = _create_access_token(
        data={"sub": user.email, "name": user.name},
        expires_delta=expires_delta,
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user_name=user.name,
        user_email=user.email,
        expires_in=int(expires_delta.total_seconds()),
    )
