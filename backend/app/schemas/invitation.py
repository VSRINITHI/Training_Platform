import uuid
from typing import Optional, Literal
from datetime import datetime
from pydantic import EmailStr, Field
from app.schemas.common import CoreBaseModel


# ─── Request Schemas ────────────────────────────────────────────────────────────

class InviteUserRequest(CoreBaseModel):
    """Request body for Admin to invite a new user."""
    email: EmailStr
    role: Literal["USER", "INSTRUCTOR"] = Field(
        ...,
        description="Assigned role for the invited user. ADMIN is not allowed via invitation.",
    )


class ResendInvitationRequest(CoreBaseModel):
    """Optional override fields when resending an invitation."""
    # Currently just a marker — can add custom message later
    pass


# ─── Response Schemas ────────────────────────────────────────────────────────────

class InvitedByResponse(CoreBaseModel):
    id: uuid.UUID
    email: str
    full_name: str


class InvitationResponse(CoreBaseModel):
    id: uuid.UUID
    email: str
    role: str
    status: str  # PENDING | ACCEPTED | EXPIRED | FAILED | CANCELLED
    invited_by: Optional[InvitedByResponse] = None
    supabase_user_id: Optional[uuid.UUID] = None
    invited_at: datetime
    accepted_at: Optional[datetime] = None
    expires_at: datetime
    resent_count: int
    notes: Optional[str] = None
    email_sent: bool = True
    email_error: Optional[str] = None


class InvitationListResponse(CoreBaseModel):
    invitations: list[InvitationResponse]
    total: int
