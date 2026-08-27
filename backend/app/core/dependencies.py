import uuid
import logging
from typing import Callable, Generator, List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.database import SessionLocal
from app.core.security import decode_token
from app.models.user import User
from app.models.enums import UserRole

logger = logging.getLogger(__name__)

# Security scheme for Bearer token extraction
security_scheme = HTTPBearer(auto_error=True)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a SQLAlchemy session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Decodes the Supabase JWT token, extracts user claims, and synchronizes
    the user profile with public.users.
    """
    token = credentials.credentials
    payload = decode_token(token)

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing subject identifier (sub)",
        )

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token",
        )

    email = payload.get("email", "")
    user_metadata = payload.get("user_metadata", {}) or {}
    app_metadata = payload.get("app_metadata", {}) or {}

    # Extract metadata attributes
    full_name = (
        user_metadata.get("full_name")
        or user_metadata.get("name")
        or (email.split("@")[0] if email else "User")
    )
    avatar_url = user_metadata.get("avatar_url") or user_metadata.get("picture")

    # Check if a specific role is provided in app_metadata
    role_claim = app_metadata.get("role") or user_metadata.get("role")
    assigned_role = UserRole.USER
    if role_claim:
        try:
            assigned_role = UserRole(str(role_claim).upper())
        except ValueError:
            assigned_role = UserRole.USER

    # Look up user in public.users
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        # Profile synchronization: Create user in public.users
        try:
            user = User(
                id=user_id,
                email=email,
                full_name=full_name,
                role=assigned_role,
                avatar_url=avatar_url,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(f"Synchronized new user profile for ID: {user_id}")
        except IntegrityError:
            # Handle concurrent creation race condition
            db.rollback()
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to synchronize user profile",
                )
    else:
        # Update user metadata if email or name changed
        updated = False
        if email and user.email != email:
            user.email = email
            updated = True
        if full_name and user.full_name != full_name and full_name != email.split("@")[0]:
            user.full_name = full_name
            updated = True
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
            updated = True

        if updated:
            db.commit()
            db.refresh(user)

    return user


def require_role(*allowed_roles: UserRole) -> Callable[[User], User]:
    """
    Role-Based Access Control (RBAC) dependency factory.
    Enforces that the current authenticated user has one of the allowed roles.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            role_names = ", ".join([r.value for r in allowed_roles])
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of the following roles: [{role_names}]. Current role: '{current_user.role.value}'",
            )
        return current_user

    return role_checker
