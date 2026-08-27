import uuid
from typing import List, Optional
from datetime import datetime
from sqlalchemy import (
    Boolean,
    Integer,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.enums import EnrollmentStatus, ModuleProgressStatus


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_enrollments_user_course"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[EnrollmentStatus] = mapped_column(
        ENUM(EnrollmentStatus, name="enrollment_status", create_type=False),
        nullable=False,
        default=EnrollmentStatus.ACTIVE,
    )
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", back_populates="enrollments"
    )
    course: Mapped["Course"] = relationship(  # type: ignore[name-defined]
        "Course", back_populates="enrollments"
    )
    module_progress_records: Mapped[List["ModuleProgress"]] = relationship(
        "ModuleProgress", back_populates="enrollment", cascade="all, delete-orphan"
    )
    certificate: Mapped[Optional["Certificate"]] = relationship(  # type: ignore[name-defined]
        "Certificate", back_populates="enrollment", uselist=False, cascade="all, delete-orphan"
    )


class ModuleProgress(Base):
    __tablename__ = "module_progress"
    __table_args__ = (
        UniqueConstraint("enrollment_id", "module_id", name="uq_module_progress_enrollment_module"),
        CheckConstraint("attempts_used >= 0", name="chk_module_progress_attempts"),
        Index("idx_module_progress_enrollment_status", "enrollment_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
    )
    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("modules.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[ModuleProgressStatus] = mapped_column(
        ENUM(ModuleProgressStatus, name="module_progress_status", create_type=False),
        nullable=False,
        default=ModuleProgressStatus.NOT_STARTED,
    )
    attempts_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    relearning_triggered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    enrollment: Mapped["Enrollment"] = relationship("Enrollment", back_populates="module_progress_records")
    module: Mapped["Module"] = relationship(  # type: ignore[name-defined]
        "Module", back_populates="progress_records"
    )
    lesson_progress_records: Mapped[List["LessonProgress"]] = relationship(
        "LessonProgress", back_populates="module_progress", cascade="all, delete-orphan"
    )
    quiz_attempts: Mapped[List["QuizAttempt"]] = relationship(  # type: ignore[name-defined]
        "QuizAttempt", back_populates="module_progress"
    )


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (
        UniqueConstraint("module_progress_id", "lesson_id", name="uq_lesson_progress_module_lesson"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    module_progress_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("module_progress.id", ondelete="CASCADE"),
        nullable=False,
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    module_progress: Mapped["ModuleProgress"] = relationship("ModuleProgress", back_populates="lesson_progress_records")
    lesson: Mapped["Lesson"] = relationship(  # type: ignore[name-defined]
        "Lesson", back_populates="progress_records"
    )
