import uuid
from typing import Optional, List
from datetime import datetime
from pydantic import EmailStr, Field
from app.schemas.common import CoreBaseModel
from app.models.enums import UserRole


class UserBase(CoreBaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole = UserRole.USER
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    id: uuid.UUID = Field(..., description="Must match Supabase auth.users(id)")


class UserUpdate(CoreBaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    avatar_url: Optional[str] = None
    role: Optional[UserRole] = None


class UserResponse(UserBase):
    id: uuid.UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserInterestCreate(CoreBaseModel):
    sub_domain_id: uuid.UUID


class UserInterestResponse(CoreBaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    sub_domain_id: uuid.UUID
    created_at: datetime


class UserInterestsUpdate(CoreBaseModel):
    sub_domain_ids: List[uuid.UUID] = Field(..., description="List of selected sub-domain IDs")
