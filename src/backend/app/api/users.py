"""
User Management API router for Role-Based Access Control (RBAC).
Provides CRUD operations, password reset, and section permission management under Main Admin.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.database.session import get_db
from app.models.models import User
from app.schemas.schemas import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserPasswordReset,
    UserMinimal,
)
from app.api.auth_deps import get_current_user, require_main_admin

router = APIRouter(prefix="/users", tags=["User Management"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEFAULT_PERMISSIONS = {
    "dashboard": "rw",
    "assets": "rw",
    "tickets": "rw",
    "maintenance": "rw",
    "iot": "rw",
    "weather": "rw",
    "incidents": "rw",
    "advisor": "rw",
    "users": "rw",
    "settings": "rw",
}


@router.get("", response_model=List[UserResponse])
def list_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all registered system users with optional search and role filtering.
    """
    query = db.query(User)

    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.filter(
            (User.email.ilike(search_term)) | (User.name.ilike(search_term))
        )

    if role:
        query = query.filter(User.role == role)

    users = query.order_by(User.id.asc()).all()
    return users


@router.get("/assignable", response_model=List[UserMinimal])
def list_assignable_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List active users who can be assigned maintenance & fix issue tickets.
    """
    users = (
        db.query(User)
        .filter(User.is_active == True)
        .order_by(User.name.asc())
        .all()
    )
    return users


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    current_user: User = Depends(require_main_admin),
    db: Session = Depends(get_db),
):
    """
    Main Admin creates a new user account with credentials, role, and section permissions.
    """
    email_clean = body.email.lower().strip()

    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    permissions = body.permissions or DEFAULT_PERMISSIONS

    user = User(
        email=email_clean,
        hashed_password=pwd_context.hash(body.password),
        name=body.name.strip(),
        role=body.role or "GRID_OPERATOR",
        department=body.department or "Grid Operations",
        phone=body.phone,
        permissions=permissions,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Fetch live current user profile, role, active status, and section permissions.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    return current_user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Fetch single user details by ID.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    body: UserUpdate,
    current_user: User = Depends(require_main_admin),
    db: Session = Depends(get_db),
):
    """
    Main Admin updates user profile, role, department, status, or section permissions.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if body.name is not None:
        user.name = body.name.strip()
    if body.role is not None:
        user.role = body.role
    if body.department is not None:
        user.department = body.department
    if body.phone is not None:
        user.phone = body.phone
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.permissions is not None:
        user.permissions = body.permissions

    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    body: UserPasswordReset,
    current_user: User = Depends(require_main_admin),
    db: Session = Depends(get_db),
):
    """
    Main Admin resets a user's password.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not body.new_password or len(body.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    user.hashed_password = pwd_context.hash(body.new_password)
    db.commit()
    return {"message": f"Password for {user.email} reset successfully."}


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_main_admin),
    db: Session = Depends(get_db),
):
    """
    Deactivate or delete user account (Main Admin only).
    Prevents deleting self.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Main Admin cannot delete their own account.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_active = False
    db.commit()
    return {"message": f"User {user.email} account deactivated."}
