import uuid
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    String,
    Text,
    Boolean,
    Integer,
    Numeric,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        UniqueConstraint("user_id", "quiz_id", "attempt_number", name="uq_quiz_attempts_user_quiz_attempt"),
        CheckConstraint("attempt_number >= 1", name="chk_quiz_attempts_attempt_number"),
        CheckConstraint("attempt_cycle >= 1", name="chk_quiz_attempts_attempt_cycle"),
        CheckConstraint("score_achieved >= 0.00 AND score_achieved <= 100.00", name="chk_quiz_attempts_score"),
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
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    module_progress_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("module_progress.id", ondelete="SET NULL"),
        nullable=True,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    attempt_cycle: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    score_achieved: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    is_passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    submitted_answers: Mapped[Any] = mapped_column(JSONB, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", back_populates="quiz_attempts"
    )
    quiz: Mapped["Quiz"] = relationship(  # type: ignore[name-defined]
        "Quiz", back_populates="attempts"
    )
    module_progress: Mapped[Optional["ModuleProgress"]] = relationship(  # type: ignore[name-defined]
        "ModuleProgress", back_populates="quiz_attempts"
    )


class Certificate(Base):
    __tablename__ = "certificates"
    __table_args__ = (
        UniqueConstraint("enrollment_id", name="uq_certificates_enrollment"),
        UniqueConstraint("certificate_number", name="uq_certificates_number"),
        UniqueConstraint("verification_hash", name="uq_certificates_hash"),
        Index("idx_certificates_verification_hash", "verification_hash"),
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
        unique=True,
        nullable=False,
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
    certificate_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    pdf_storage_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verification_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)

    # Relationships
    enrollment: Mapped["Enrollment"] = relationship(  # type: ignore[name-defined]
        "Enrollment", back_populates="certificate"
    )
    user: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", back_populates="certificates"
    )
    course: Mapped["Course"] = relationship(  # type: ignore[name-defined]
        "Course", back_populates="certificates"
    )
