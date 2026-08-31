import uuid
from typing import Optional, List, Any
from datetime import datetime
from decimal import Decimal
from pydantic import Field
from app.schemas.common import CoreBaseModel
from app.schemas.course import CourseResponse
from app.models.enums import EnrollmentStatus, ModuleProgressStatus


class LessonProgressResponse(CoreBaseModel):
    id: uuid.UUID
    module_progress_id: uuid.UUID
    lesson_id: uuid.UUID
    is_completed: bool
    completed_at: Optional[datetime] = None


class LessonProgressUpdate(CoreBaseModel):
    is_completed: bool = True


class ModuleProgressResponse(CoreBaseModel):
    id: uuid.UUID
    enrollment_id: uuid.UUID
    module_id: uuid.UUID
    status: ModuleProgressStatus
    attempts_used: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    relearning_triggered_at: Optional[datetime] = None
    lesson_progress_records: List[LessonProgressResponse] = []


class ModuleProgressDetailResponse(ModuleProgressResponse):
    module_title: str
    order_index: int
    is_required: bool
    is_unlocked: bool
    total_lessons_count: int = 0
    completed_lessons_count: int = 0


class EnrollmentCreate(CoreBaseModel):
    course_id: uuid.UUID


class EnrollmentResponse(CoreBaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    course_id: uuid.UUID
    status: EnrollmentStatus
    enrolled_at: datetime
    completed_at: Optional[datetime] = None


class EnrollmentDetailResponse(EnrollmentResponse):
    course: Optional[CourseResponse] = None
    progress_pct: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("100.00"))


class CourseProgressResponse(CoreBaseModel):
    """
    Dynamic progress representation computed at runtime from module_progress.
    """
    enrollment_id: uuid.UUID
    course_id: uuid.UUID
    status: EnrollmentStatus
    total_required_modules: int
    completed_required_modules: int
    progress_pct: Decimal = Field(..., ge=Decimal("0.00"), le=Decimal("100.00"))
    is_final_exam_unlocked: bool
    is_course_completed: bool
    modules: List[ModuleProgressDetailResponse] = []
