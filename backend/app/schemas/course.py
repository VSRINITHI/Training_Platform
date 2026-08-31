import uuid
from typing import Optional, List
from datetime import datetime
from pydantic import Field, model_validator
from app.schemas.common import CoreBaseModel
from app.schemas.user import UserResponse
from app.schemas.taxonomy import SubDomainResponse
from app.models.enums import DifficultyLevel


# ---------------------------------------------------------------------------
# Lesson Schemas
# ---------------------------------------------------------------------------
class LessonBase(CoreBaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content_body: Optional[str] = None
    video_url: Optional[str] = None
    document_url: Optional[str] = None
    duration_minutes: int = Field(default=0, ge=0)
    order_index: Optional[int] = Field(default=None, ge=1)


class LessonCreate(LessonBase):
    module_id: Optional[uuid.UUID] = None


class LessonUpdate(CoreBaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content_body: Optional[str] = None
    video_url: Optional[str] = None
    document_url: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=0)
    order_index: Optional[int] = Field(None, ge=1)


class LessonResponse(CoreBaseModel):
    id: uuid.UUID
    module_id: uuid.UUID
    title: str
    content_body: Optional[str] = None
    video_url: Optional[str] = None
    document_url: Optional[str] = None
    duration_minutes: int
    order_index: int
    created_at: datetime


# ---------------------------------------------------------------------------
# Module Schemas
# ---------------------------------------------------------------------------
class ModuleBase(CoreBaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    order_index: Optional[int] = Field(default=None, ge=1)
    is_required: bool = True


class ModuleCreate(ModuleBase):
    course_id: Optional[uuid.UUID] = None


class ModuleUpdate(CoreBaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    order_index: Optional[int] = Field(None, ge=1)
    is_required: Optional[bool] = None


class ModuleResponse(CoreBaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: Optional[str] = None
    order_index: int
    is_required: bool
    created_at: datetime


class ModuleDetailResponse(ModuleResponse):
    lessons: List[LessonResponse] = []


# ---------------------------------------------------------------------------
# Course Schemas
# ---------------------------------------------------------------------------
class CourseBase(CoreBaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255)
    description: str
    thumbnail_url: Optional[str] = None
    difficulty_level: Optional[DifficultyLevel] = None
    is_published: bool = False


class CourseCreate(CourseBase):
    sub_domain_id: uuid.UUID
    instructor_id: Optional[uuid.UUID] = Field(None, description="Admin only; defaults to current user")


class CourseUpdate(CoreBaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    difficulty_level: Optional[DifficultyLevel] = None
    sub_domain_id: Optional[uuid.UUID] = None
    is_published: Optional[bool] = None


class CourseResponse(CourseBase):
    id: uuid.UUID
    instructor_id: uuid.UUID
    sub_domain_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CourseDetailResponse(CourseResponse):
    instructor: Optional[UserResponse] = None
    sub_domain: Optional[SubDomainResponse] = None
    modules: List[ModuleDetailResponse] = []


# ---------------------------------------------------------------------------
# Reordering & Publishing Schemas
# ---------------------------------------------------------------------------
class OrderItem(CoreBaseModel):
    id: uuid.UUID
    order_index: int = Field(..., ge=1)


class ReorderRequest(CoreBaseModel):
    items: List[OrderItem] = Field(..., min_length=1)


class CoursePublishResponse(CoreBaseModel):
    id: uuid.UUID
    is_published: bool
    message: str
