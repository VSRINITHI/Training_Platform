import uuid
from typing import List, Optional, Any
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
    text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.enums import QuizType, QuestionType, AIDraftStatus


class Quiz(Base):
    __tablename__ = "quizzes"
    __table_args__ = (
        CheckConstraint(
            "(lesson_id IS NOT NULL)::int + (module_id IS NOT NULL)::int + (course_id IS NOT NULL)::int = 1",
            name="chk_quizzes_single_target",
        ),
        CheckConstraint(
            "((quiz_type = 'LESSON' AND lesson_id IS NOT NULL AND module_id IS NULL AND course_id IS NULL) OR "
            "(quiz_type = 'MODULE' AND module_id IS NOT NULL AND lesson_id IS NULL AND course_id IS NULL) OR "
            "(quiz_type = 'FINAL' AND course_id IS NOT NULL AND lesson_id IS NULL AND module_id IS NULL))",
            name="chk_quizzes_type_target_alignment",
        ),
        CheckConstraint(
            "passing_score >= 0.00 AND passing_score <= 100.00",
            name="chk_quizzes_passing_score",
        ),
        CheckConstraint("max_attempts >= 1", name="chk_quizzes_max_attempts"),
        Index(
            "uq_quiz_per_lesson",
            "lesson_id",
            unique=True,
            postgresql_where=text("quiz_type = 'LESSON'"),
        ),
        Index(
            "uq_quiz_per_module",
            "module_id",
            unique=True,
            postgresql_where=text("quiz_type = 'MODULE'"),
        ),
        Index(
            "uq_quiz_per_course_final",
            "course_id",
            unique=True,
            postgresql_where=text("quiz_type = 'FINAL'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quiz_type: Mapped[QuizType] = mapped_column(
        ENUM(QuizType, name="quiz_type", create_type=False), nullable=False
    )
    lesson_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=True,
    )
    module_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("modules.id", ondelete="CASCADE"),
        nullable=True,
    )
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=True,
    )
    passing_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    time_limit_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    lesson: Mapped[Optional["Lesson"]] = relationship(  # type: ignore[name-defined]
        "Lesson", back_populates="quizzes"
    )
    module: Mapped[Optional["Module"]] = relationship(  # type: ignore[name-defined]
        "Module", back_populates="quizzes"
    )
    course: Mapped[Optional["Course"]] = relationship(  # type: ignore[name-defined]
        "Course", back_populates="quizzes"
    )
    questions: Mapped[List["Question"]] = relationship(
        "Question", back_populates="quiz", cascade="all, delete-orphan", order_by="Question.order_index"
    )
    attempts: Mapped[List["QuizAttempt"]] = relationship(  # type: ignore[name-defined]
        "QuizAttempt", back_populates="quiz"
    )


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        UniqueConstraint("quiz_id", "order_index", name="uq_questions_quiz_order"),
        CheckConstraint("points >= 1", name="chk_questions_points"),
        CheckConstraint("order_index >= 1", name="chk_questions_order_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(
        ENUM(QuestionType, name="question_type", create_type=False),
        nullable=False,
        default=QuestionType.MCQ,
    )
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    points: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    quiz: Mapped["Quiz"] = relationship("Quiz", back_populates="questions")
    options: Mapped[List["QuestionOption"]] = relationship(
        "QuestionOption", back_populates="question", cascade="all, delete-orphan", order_by="QuestionOption.order_index"
    )


class QuestionOption(Base):
    __tablename__ = "question_options"
    __table_args__ = (
        UniqueConstraint("question_id", "order_index", name="uq_question_options_order"),
        CheckConstraint("order_index >= 1", name="chk_question_options_order_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    option_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    question: Mapped["Question"] = relationship("Question", back_populates="options")


class AIQuizDraft(Base):
    __tablename__ = "ai_quiz_drafts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=False,
    )
    instructor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    prompt_context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_llm_response: Mapped[Any] = mapped_column(JSONB, nullable=False)
    status: Mapped[AIDraftStatus] = mapped_column(
        ENUM(AIDraftStatus, name="ai_draft_status", create_type=False),
        nullable=False,
        default=AIDraftStatus.PENDING_REVIEW,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    lesson: Mapped["Lesson"] = relationship(  # type: ignore[name-defined]
        "Lesson", back_populates="ai_drafts"
    )
    instructor: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User"
    )
