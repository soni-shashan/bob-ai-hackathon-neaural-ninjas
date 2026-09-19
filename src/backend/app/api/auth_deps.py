"""
Authentication dependencies for FastAPI route protection.
Extracts and validates JWT tokens from the Authorization header.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.config import settings
from app.database.session import get_db
from app.models.models import User

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates the JWT token from the Authorization header.
    Returns the authenticated User or raises 401.
    """
    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_email: str = payload.get("sub")
        if user_email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == user_email).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    return user


def require_main_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Enforces that the authenticated user has MAIN_ADMIN role.
    """
    if current_user.role != "MAIN_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Main Admin privilege required",
        )
    return current_user


def check_section_permission(user: User, section: str, level: str = "r") -> bool:
    """
    Helper function to check if user has access to a specific section.
    MAIN_ADMIN has full access to all sections.
    """
    if user.role == "MAIN_ADMIN":
        return True
    if not user.permissions or not isinstance(user.permissions, dict):
        return True
    perm = user.permissions.get(section, "rw")
    if perm == "none":
        return False
    if level == "rw" and perm != "rw":
        return False
    return True


def require_permission(section: str, level: str = "r"):
    """
    FastAPI Dependency to enforce section-level access (Read or Read/Write).
    Usage: dependencies=[Depends(require_permission("assets", "rw"))]
    """
    def dependency(user: User = Depends(get_current_user)) -> User:
        if not check_section_permission(user, section, level):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Insufficient '{level.upper()}' permissions for section '{section}'."
            )
        return user
    return dependency


