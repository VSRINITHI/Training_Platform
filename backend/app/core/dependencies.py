import uuid
import logging
from datetime import datetime, timezone
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

            # Mark any pending invitation for this email as ACCEPTED
            _accept_invitation_if_pending(db, email)

        except IntegrityError:
            # Handle concurrent creation race condition
            db.rollback()
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"Failed to synchronize user profile for ID {user_id} after IntegrityError")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to synchronize user profile",
                )
        except Exception as e:
            db.rollback()
            logger.error(f"Unexpected error synchronizing user profile {user_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to synchronize user profile: {str(e)}",
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

        # Also accept any pending invitation for existing users on sync
        _accept_invitation_if_pending(db, email)

    # Clean up stale app_metadata flags.
    # supabase.auth.updateUser() from the client can only modify user_metadata,
    # not app_metadata. After SetPasswordPage clears needs_password in
    # user_metadata, app_metadata still has the old flags. Use the server-side
    # admin API to clean them up so subsequent JWTs are fully consistent.
    app_needs_pw = app_metadata.get("needs_password")
    app_is_invited = app_metadata.get("is_invited")
    user_needs_pw = user_metadata.get("needs_password")

    if (app_needs_pw is True or app_is_invited is True) and user_needs_pw is False:
        _clear_stale_app_metadata(str(user_id))

    return user


def _accept_invitation_if_pending(db: Session, email: str) -> None:
    """
    When a new user is successfully created in public.users,
    check if a pending invitation exists for their email and mark it ACCEPTED.
    Imported lazily to avoid circular imports with the invitation model.
    """
    try:
        # Lazy import to avoid circular dependency at module load time
        from app.models.invitation import UserInvitation
        now = datetime.now(timezone.utc)
        pending = (
            db.query(UserInvitation)
            .filter(
                UserInvitation.email == email.lower(),
                UserInvitation.status == "PENDING",
            )
            .first()
        )
        if pending:
            pending.status = "ACCEPTED"
            pending.accepted_at = now
            db.commit()
            logger.info("Invitation ACCEPTED for email: %s (invitation id: %s)", email, pending.id)
    except Exception as e:
        # Never block authentication due to invitation bookkeeping errors
        logger.warning("Could not update invitation status for %s: %s", email, e)


def _clear_stale_app_metadata(user_id: str) -> None:
    """
    Uses the Supabase Admin API (server-side service-role key) to remove
    stale needs_password and is_invited flags from app_metadata.

    This is needed because supabase.auth.updateUser() from the client SDK
    can only modify user_metadata, not app_metadata. After the user sets
    their password (clearing user_metadata.needs_password), app_metadata
    still has the old flags. This function cleans them up so that future
    JWTs no longer carry stale invitation flags.

    This function is fire-and-forget — failures are logged but never block
    the authentication flow.
    """
    try:
        from app.core.config import settings
        import httpx

        key = settings.SUPABASE_SECRET_KEY
        if not key:
            return

        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{user_id}"
        body = {
            "app_metadata": {
                "needs_password": False,
                "is_invited": False,
            },
        }
        r = httpx.put(url, headers=headers, json=body, timeout=10)
        if r.status_code in (200, 201):
            logger.info("Cleared stale app_metadata flags for user %s", user_id)
        else:
            logger.warning(
                "Failed to clear app_metadata for user %s: status=%d body=%s",
                user_id, r.status_code, r.text[:200],
            )
    except Exception as e:
        logger.warning("Could not clear stale app_metadata for %s: %s", user_id, e)


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
