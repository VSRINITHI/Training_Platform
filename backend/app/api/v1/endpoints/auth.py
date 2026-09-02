import logging
import uuid
from typing import List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.dependencies import get_db, get_current_user, require_role
from app.models.user import User
from app.models.course import Course
from app.models.invitation import UserInvitation
from app.models.enums import UserRole
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.common import MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication & User Profiles"])


def _supabase_admin_headers() -> dict:
    """Returns headers for Supabase Admin API calls using server-side secret key."""
    key = settings.SUPABASE_SECRET_KEY
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase service-role key is not configured on the server.",
        )
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


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


@router.get(
    "/users",
    response_model=List[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="List platform users (Admin only)",
)
def list_users(
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> List[UserResponse]:
    """
    Admin-only endpoint to list all platform users with optional email/name search and role filter.
    """
    query = db.query(User)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter((User.email.ilike(s)) | (User.full_name.ilike(s)))
    if role:
        query = query.filter(User.role == role)
    return query.order_by(User.created_at.desc()).all()


@router.delete(
    "/users/{user_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete a user account and associated records (Admin only)",
)
def delete_user(
    user_id: uuid.UUID,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Permanently deletes a user account and all associated relational and auth data.

    Safety constraints:
    1. Admin cannot delete their own account.
    2. If the user is an INSTRUCTOR with authored courses, those courses (and their
       cascading modules, lessons, quizzes, attempts, and enrollments) are safely removed.
    3. User's enrollments, progress, certificates, quiz attempts, interests, and invitations
       are cleaned up safely with no orphaned records.
    4. The user is deleted from Supabase Auth (auth.users) via the server-side Admin API.
    5. The user is deleted from public.users in PostgreSQL.
    """
    if admin_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own account.",
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in public database.",
        )

    target_email = target_user.email
    target_role = target_user.role.value

    # 1. If instructor, delete any authored courses safely
    authored_courses = db.query(Course).filter(Course.instructor_id == user_id).all()
    for course in authored_courses:
        logger.info(
            "Deleting authored course '%s' (%s) prior to instructor deletion (%s)",
            course.title,
            course.id,
            target_email,
        )
        db.delete(course)
    db.flush()

    # 2. Clean up any invitations associated with this email or user id
    db.query(UserInvitation).filter(
        (UserInvitation.email == target_email.lower()) | (UserInvitation.supabase_user_id == user_id)
    ).delete(synchronize_session=False)

    # 3. Delete from public.users (cascades to interests, enrollments, progress, attempts, certificates)
    db.delete(target_user)
    db.commit()

    # 4. Delete from Supabase Auth (auth.users) via Admin API
    try:
        headers = _supabase_admin_headers()
        del_url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{user_id}"
        r = httpx.delete(del_url, headers=headers, timeout=15)
        if r.status_code not in (200, 204, 404):
            logger.warning(
                "Supabase Auth user deletion returned status %d for %s: %s",
                r.status_code,
                user_id,
                r.text,
            )
        else:
            logger.info("Deleted Supabase Auth user %s (%s)", user_id, target_email)
    except Exception as e:
        logger.error("Failed to delete Supabase Auth user %s: %s", user_id, e)
        # Even if Supabase Admin call times out or errors, DB record is already cleaned up

    return MessageResponse(
        message=f"User '{target_email}' ({target_role}) and associated records have been deleted successfully."
    )
