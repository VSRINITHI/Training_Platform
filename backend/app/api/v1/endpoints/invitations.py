"""
Admin-only User Invitation endpoints.

Security model:
- All endpoints require ADMIN role (enforced via require_role).
- Supabase service-role key is used server-side ONLY via httpx — never sent to the client.
- Invitation emails are sent via SMTP with backend credentials only.
- The Supabase Admin API generates the invite link, which includes the configured redirect_to.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_db, require_role
from app.core.email import send_invitation_email
from app.models.enums import UserRole
from app.models.invitation import UserInvitation
from app.models.user import User
from app.schemas.invitation import (
    InviteUserRequest,
    InvitationResponse,
    InvitationListResponse,
    InvitedByResponse,
)
from app.schemas.common import MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["User Invitations"])

INVITATION_EXPIRY_DAYS = 7


# ─── Helpers ─────────────────────────────────────────────────────────────────────

def _supabase_admin_headers() -> dict:
    """Returns headers for Supabase Admin API calls. Uses service-role key (backend only)."""
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


def _invitation_to_response(
    inv: UserInvitation,
    email_sent: bool = True,
    email_error: Optional[str] = None,
) -> InvitationResponse:
    invited_by = None
    if inv.invited_by:
        invited_by = InvitedByResponse(
            id=inv.invited_by.id,
            email=inv.invited_by.email,
            full_name=inv.invited_by.full_name,
        )
    return InvitationResponse(
        id=inv.id,
        email=inv.email,
        role=inv.role,
        status=inv.status,
        invited_by=invited_by,
        supabase_user_id=inv.supabase_user_id,
        invited_at=inv.invited_at,
        accepted_at=inv.accepted_at,
        expires_at=inv.expires_at,
        resent_count=inv.resent_count,
        notes=inv.notes,
        email_sent=email_sent,
        email_error=email_error,
    )


def _expire_stale_invitations(db: Session) -> None:
    """Marks PENDING invitations past their expiry date as EXPIRED."""
    now = datetime.now(timezone.utc)
    stale = (
        db.query(UserInvitation)
        .filter(UserInvitation.status == "PENDING", UserInvitation.expires_at < now)
        .all()
    )
    for inv in stale:
        inv.status = "EXPIRED"
    if stale:
        db.commit()
        logger.info("Expired %d stale invitations.", len(stale))


def _create_supabase_invite(
    email: str,
    role: str,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Creates an invited user in Supabase Auth with the correct app_metadata role,
    then generates the action_link for the custom email.

    Returns: (supabase_user_id, action_link, error_message)
    All Supabase API calls use the backend service-role key exclusively.
    """
    headers = _supabase_admin_headers()
    redirect_to = f"{settings.FRONTEND_URL}/auth/callback?type=invite"

    # Step 1: Create invited user with app_metadata.role pre-set
    # This ensures get_current_user() assigns the correct role on first sync.
    create_url = f"{settings.SUPABASE_URL}/auth/v1/admin/users"
    create_body = {
        "email": email,
        "invite": True,
        "app_metadata": {
            "role": role,
            "needs_password": True,
            "is_invited": True,
        },
        "user_metadata": {
            "role": role,
            "needs_password": True,
            "is_invited": True,
        },
        "email_confirm": False,
    }

    try:
        r = httpx.post(create_url, headers=headers, json=create_body, timeout=15)
        if r.status_code not in (200, 201):
            error_data = r.json()
            msg = error_data.get("msg") or error_data.get("message") or error_data.get("error", "Unknown Supabase error")
            logger.error("Supabase user creation failed for %s: %s (status %d)", email, msg, r.status_code)
            return None, None, f"Supabase error: {msg}"

        user_data = r.json()
        supabase_user_id = user_data.get("id")
        logger.info("Supabase invited user created: id=%s email=%s role=%s", supabase_user_id, email, role)

    except httpx.TimeoutException:
        return None, None, "Supabase API timed out while creating invited user."
    except Exception as e:
        return None, None, f"Failed to call Supabase Admin API: {str(e)}"

    # Step 2: Generate the invitation action_link with redirect_to
    gen_url = f"{settings.SUPABASE_URL}/auth/v1/admin/generate_link"
    gen_body = {
        "type": "invite",
        "email": email,
        "options": {"redirect_to": redirect_to},
    }

    try:
        gr = httpx.post(gen_url, headers=headers, json=gen_body, timeout=15)
        if gr.status_code not in (200, 201):
            error_data = gr.json()
            msg = error_data.get("msg") or error_data.get("message") or error_data.get("error", "Link generation failed")
            logger.error("Supabase generate_link failed for %s: %s", email, msg)
            # User was created but link gen failed — return id so we can still record
            return supabase_user_id, None, f"Invitation link generation failed: {msg}"

        gen_data = gr.json()
        action_link = gen_data.get("action_link")
        if not action_link:
            return supabase_user_id, None, "Supabase returned no action_link for invitation."

        return supabase_user_id, action_link, None

    except httpx.TimeoutException:
        return supabase_user_id, None, "Supabase API timed out while generating invite link."
    except Exception as e:
        return supabase_user_id, None, f"Failed to generate invite link: {str(e)}"


# ─── Endpoints ───────────────────────────────────────────────────────────────────

@router.post(
    "/invite",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a new user by email (Admin only)",
)
def invite_user(
    request: InviteUserRequest,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> InvitationResponse:
    """
    Admin-only endpoint to send a platform invitation to a new user.

    - Creates the user in Supabase Auth via service-role key (backend only).
    - Sets app_metadata.role so the correct role is assigned on first login.
    - Generates a branded invitation link via Supabase Admin API.
    - Sends a custom-branded HTML email (if SMTP is configured).
    - Records the invitation in user_invitations for status tracking.
    - Prevents duplicate PENDING invitations for the same email.
    """
    email = request.email.lower().strip()
    role = request.role

    # Expire any stale invitations first
    _expire_stale_invitations(db)

    # Check for duplicate pending invitation
    existing = (
        db.query(UserInvitation)
        .filter(UserInvitation.email == email, UserInvitation.status == "PENDING")
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A pending invitation already exists for {email}. Cancel or wait for it to expire before re-inviting.",
        )

    # Check if user already has an account in public.users
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email {email} already has an active account on DataCaliper.",
        )

    # Calculate expiry
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=INVITATION_EXPIRY_DAYS)

    # Call Supabase Admin API
    supabase_user_id, action_link, error_msg = _create_supabase_invite(email, role)

    # Determine invitation status
    inv_status = "PENDING" if action_link else "FAILED"
    notes = error_msg if error_msg else None

    # Create invitation record
    invitation = UserInvitation(
        email=email,
        role=role,
        status=inv_status,
        invited_by_id=admin.id,
        supabase_user_id=uuid.UUID(supabase_user_id) if supabase_user_id else None,
        invited_at=now,
        expires_at=expires_at,
        resent_count=0,
        notes=notes,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    if inv_status == "FAILED":
        logger.error("Invitation creation failed for %s: %s", email, error_msg)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create invitation in Supabase: {error_msg}",
        )

    # Send branded email via EmailService
    admin_name = admin.full_name or admin.email
    email_sent, email_err = send_invitation_email(
        recipient_email=email,
        role=role,
        action_link=action_link,
        invited_by_name=admin_name,
    )

    if not email_sent:
        logger.warning(
            "Invitation created in Supabase for %s, but email delivery failed: %s",
            email,
            email_err,
        )
        invitation.notes = f"Account created in Supabase. Email delivery warning: {email_err}"
        db.commit()
        db.refresh(invitation)

    logger.info(
        "Invitation processed: email=%s role=%s invited_by=%s email_delivered=%s",
        email,
        role,
        admin.email,
        email_sent,
    )

    return _invitation_to_response(invitation, email_sent=email_sent, email_error=email_err)


@router.get(
    "/invitations",
    response_model=InvitationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all user invitations (Admin only)",
)
def list_invitations(
    status_filter: Optional[str] = None,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> InvitationListResponse:
    """
    Returns all invitations ordered by most recent first.
    Optionally filter by status: PENDING, ACCEPTED, EXPIRED, FAILED, CANCELLED.
    Stale PENDING invitations are automatically marked EXPIRED before listing.
    """
    _expire_stale_invitations(db)

    query = db.query(UserInvitation)
    if status_filter:
        valid_statuses = {"PENDING", "ACCEPTED", "EXPIRED", "FAILED", "CANCELLED"}
        if status_filter.upper() not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter. Valid values: {', '.join(sorted(valid_statuses))}",
            )
        query = query.filter(UserInvitation.status == status_filter.upper())

    invitations = query.order_by(UserInvitation.invited_at.desc()).all()
    return InvitationListResponse(
        invitations=[_invitation_to_response(i) for i in invitations],
        total=len(invitations),
    )


@router.post(
    "/invitations/{invitation_id}/resend",
    response_model=InvitationResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend an invitation (Admin only)",
)
def resend_invitation(
    invitation_id: uuid.UUID,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> InvitationResponse:
    """
    Resends the invitation email for a PENDING invitation.
    Generates a fresh invite link and resets the expiry window.
    Cannot resend ACCEPTED, FAILED, or CANCELLED invitations.
    """
    _expire_stale_invitations(db)

    invitation = db.query(UserInvitation).filter(UserInvitation.id == invitation_id).first()
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")

    if invitation.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot resend a {invitation.status} invitation. Only PENDING invitations can be resent.",
        )

    # Generate a fresh invite link
    headers = _supabase_admin_headers()
    redirect_to = f"{settings.FRONTEND_URL}/auth/callback?type=invite"
    gen_url = f"{settings.SUPABASE_URL}/auth/v1/admin/generate_link"
    gen_body = {
        "type": "invite",
        "email": invitation.email,
        "options": {"redirect_to": redirect_to},
    }

    action_link = None
    error_msg = None
    try:
        gr = httpx.post(gen_url, headers=headers, json=gen_body, timeout=15)
        if gr.status_code in (200, 201):
            action_link = gr.json().get("action_link")
        else:
            error_data = gr.json()
            error_msg = error_data.get("msg") or error_data.get("message") or "Link generation failed"
    except Exception as e:
        error_msg = str(e)

    if not action_link:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate new invite link: {error_msg}",
        )

    # Reset expiry and increment resent counter
    now = datetime.now(timezone.utc)
    invitation.expires_at = now + timedelta(days=INVITATION_EXPIRY_DAYS)
    invitation.resent_count += 1
    invitation.notes = None
    db.commit()

    # Send branded email via EmailService
    admin_name = admin.full_name or admin.email
    email_sent, email_err = send_invitation_email(
        recipient_email=invitation.email,
        role=invitation.role,
        action_link=action_link,
        invited_by_name=admin_name,
    )

    if not email_sent:
        logger.warning(
            "Invitation resent for %s, but email delivery failed: %s",
            invitation.email,
            email_err,
        )
        invitation.notes = f"Resent in Supabase. Email delivery warning: {email_err}"
        db.commit()

    db.refresh(invitation)
    logger.info(
        "Invitation resent: id=%s email=%s resent_count=%d email_delivered=%s",
        invitation.id,
        invitation.email,
        invitation.resent_count,
        email_sent,
    )
    return _invitation_to_response(invitation, email_sent=email_sent, email_error=email_err)


@router.delete(
    "/invitations/{invitation_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel a pending invitation (Admin only)",
)
def cancel_invitation(
    invitation_id: uuid.UUID,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Cancels a PENDING invitation. Sets status to CANCELLED.
    Also deletes the corresponding Supabase Auth user (if they haven't activated yet).
    Cannot cancel already ACCEPTED, EXPIRED, FAILED, or CANCELLED invitations.
    """
    invitation = db.query(UserInvitation).filter(UserInvitation.id == invitation_id).first()
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")

    if invitation.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a {invitation.status} invitation.",
        )

    # Try to remove the pending user from Supabase Auth
    if invitation.supabase_user_id:
        try:
            headers = _supabase_admin_headers()
            del_url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{invitation.supabase_user_id}"
            dr = httpx.delete(del_url, headers=headers, timeout=10)
            if dr.status_code in (200, 204):
                logger.info("Deleted pending Supabase user %s during invitation cancellation.", invitation.supabase_user_id)
            else:
                logger.warning(
                    "Could not delete Supabase user %s during cancellation: status %d",
                    invitation.supabase_user_id, dr.status_code,
                )
        except Exception as e:
            logger.warning("Error deleting Supabase user during cancellation: %s", e)

    invitation.status = "CANCELLED"
    db.commit()

    logger.info("Invitation cancelled: id=%s email=%s by admin=%s", invitation.id, invitation.email, admin.email)
    return MessageResponse(message=f"Invitation for {invitation.email} has been cancelled.")
