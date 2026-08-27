import uuid
from typing import List, Optional
from datetime import datetime
from sqlalchemy import (
    String,
    Text,
    Boolean,
    Integer,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.enums import DifficultyLevel


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    instructor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    sub_domain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sub_domains.id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty_level: Mapped[Optional[DifficultyLevel]] = mapped_column(
        ENUM(DifficultyLevel, name="difficulty_level", create_type=False),
        nullable=True,
    )
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    instructor: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", back_populates="authored_courses"
    )
    sub_domain: Mapped["SubDomain"] = relationship(  # type: ignore[name-defined]
        "SubDomain", back_populates="courses"
    )
    modules: Mapped[List["Module"]] = relationship(
        "Module", back_populates="course", cascade="all, delete-orphan", order_by="Module.order_index"
    )
    quizzes: Mapped[List["Quiz"]] = relationship(  # type: ignore[name-defined]
        "Quiz", back_populates="course", cascade="all, delete-orphan"
    )
    enrollments: Mapped[List["Enrollment"]] = relationship(  # type: ignore[name-defined]
        "Enrollment", back_populates="course", cascade="all, delete-orphan"
    )
    certificates: Mapped[List["Certificate"]] = relationship(  # type: ignore[name-defined]
        "Certificate", back_populates="course", cascade="all, delete-orphan"
    )


class Module(Base):
    __tablename__ = "modules"
    __table_args__ = (
        UniqueConstraint("course_id", "order_index", name="uq_modules_course_order"),
        CheckConstraint("order_index >= 1", name="chk_modules_order_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    course: Mapped["Course"] = relationship("Course", back_populates="modules")
    lessons: Mapped[List["Lesson"]] = relationship(
        "Lesson", back_populates="module", cascade="all, delete-orphan", order_by="Lesson.order_index"
    )
    quizzes: Mapped[List["Quiz"]] = relationship(  # type: ignore[name-defined]
        "Quiz", back_populates="module", cascade="all, delete-orphan"
    )
    progress_records: Mapped[List["ModuleProgress"]] = relationship(  # type: ignore[name-defined]
        "ModuleProgress", back_populates="module", cascade="all, delete-orphan"
    )


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        UniqueConstraint("module_id", "order_index", name="uq_lessons_module_order"),
        CheckConstraint("order_index >= 1", name="chk_lessons_order_positive"),
        CheckConstraint("duration_minutes >= 0", name="chk_lessons_duration_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("modules.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    video_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    document_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    module: Mapped["Module"] = relationship("Module", back_populates="lessons")
    quizzes: Mapped[List["Quiz"]] = relationship(  # type: ignore[name-defined]
        "Quiz", back_populates="lesson", cascade="all, delete-orphan"
    )
    ai_drafts: Mapped[List["AIQuizDraft"]] = relationship(  # type: ignore[name-defined]
        "AIQuizDraft", back_populates="lesson", cascade="all, delete-orphan"
    )
    progress_records: Mapped[List["LessonProgress"]] = relationship(  # type: ignore[name-defined]
        "LessonProgress", back_populates="lesson", cascade="all, delete-orphan"
    )
