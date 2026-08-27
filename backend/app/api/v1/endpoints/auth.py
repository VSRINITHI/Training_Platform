import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user, require_role
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/auth", tags=["Authentication & User Profiles"])


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
)
def get_my_profile(current_user: User = Depends(get_current_user)) -> UserResponse:
    """
    Returns the authenticated user's profile from public.users.
    If this is the user's first request, their profile is automatically synchronized.
    """
    return current_user


@router.post(
    "/sync",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Explicitly synchronize user profile from Supabase Auth token",
)
def sync_profile(current_user: User = Depends(get_current_user)) -> UserResponse:
    """
    Explicitly synchronizes the user profile from Supabase JWT claims.
    """
    return current_user


@router.patch(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update current user profile",
)
def update_my_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """
    Updates the authenticated user's profile information (e.g. full_name, avatar_url).
    Users cannot elevate their own role through this endpoint.
    """
    if update_data.full_name is not None:
        current_user.full_name = update_data.full_name
    if update_data.avatar_url is not None:
        current_user.avatar_url = update_data.avatar_url

    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch(
    "/users/{user_id}/role",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Assign user role (Admin only)",
)
def assign_user_role(
    user_id: uuid.UUID,
    role_update: UserUpdate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> UserResponse:
    """
    Admin endpoint to assign a role (ADMIN, INSTRUCTOR, USER) to a user.
    """
    if not role_update.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be specified",
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    target_user.role = role_update.role
    db.commit()
    db.refresh(target_user)
    return target_user
