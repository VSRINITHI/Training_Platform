import uuid
from typing import Optional, List, Any
from datetime import datetime
from decimal import Decimal
from pydantic import Field, model_validator
from app.schemas.common import CoreBaseModel
from app.models.enums import QuizType, QuestionType, AIDraftStatus


# ---------------------------------------------------------------------------
# Question Option Schemas
# ---------------------------------------------------------------------------
class QuestionOptionBase(CoreBaseModel):
    option_text: str = Field(..., min_length=1)
    is_correct: bool = False
    order_index: int = Field(..., ge=1)


class QuestionOptionCreate(QuestionOptionBase):
    pass


class QuestionOptionResponse(QuestionOptionBase):
    id: uuid.UUID
    question_id: uuid.UUID


class QuestionOptionPublicResponse(CoreBaseModel):
    """
    Public representation returned to learners taking a quiz.
    Does NOT include is_correct to prevent answer leakage.
    """
    id: uuid.UUID
    question_id: uuid.UUID
    option_text: str
    order_index: int


# ---------------------------------------------------------------------------
# Question Schemas
# ---------------------------------------------------------------------------
class QuestionBase(CoreBaseModel):
    question_text: str = Field(..., min_length=1)
    question_type: QuestionType = QuestionType.MCQ
    explanation: Optional[str] = None
    points: int = Field(default=1, ge=1)
    order_index: int = Field(..., ge=1)


class QuestionCreate(QuestionBase):
    quiz_id: uuid.UUID
    options: List[QuestionOptionCreate] = Field(..., min_length=2)


class QuestionUpdate(CoreBaseModel):
    question_text: Optional[str] = Field(None, min_length=1)
    question_type: Optional[QuestionType] = None
    explanation: Optional[str] = None
    points: Optional[int] = Field(None, ge=1)
    order_index: Optional[int] = Field(None, ge=1)


class QuestionResponse(QuestionBase):
    id: uuid.UUID
    quiz_id: uuid.UUID
    options: List[QuestionOptionResponse] = []


class QuestionPublicResponse(CoreBaseModel):
    """
    Question representation for learners taking the quiz (answers hidden).
    """
    id: uuid.UUID
    quiz_id: uuid.UUID
    question_text: str
    question_type: QuestionType
    points: int
    order_index: int
    options: List[QuestionOptionPublicResponse] = []


# ---------------------------------------------------------------------------
# Quiz Schemas
# ---------------------------------------------------------------------------
class QuizBase(CoreBaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    quiz_type: QuizType
    lesson_id: Optional[uuid.UUID] = None
    module_id: Optional[uuid.UUID] = None
    course_id: Optional[uuid.UUID] = None
    passing_score: Decimal = Field(..., ge=Decimal("0.00"), le=Decimal("100.00"))
    max_attempts: int = Field(default=3, ge=1)
    time_limit_minutes: Optional[int] = Field(None, ge=1)
    is_active: bool = True

    @model_validator(mode="after")
    def validate_type_to_target(self) -> "QuizBase":
        targets = [bool(self.lesson_id), bool(self.module_id), bool(self.course_id)]
        if sum(targets) != 1:
            raise ValueError("Quiz must belong to exactly one target (lesson_id, module_id, or course_id)")
        
        if self.quiz_type == QuizType.LESSON and not self.lesson_id:
            raise ValueError("LESSON quiz must have lesson_id set")
        if self.quiz_type == QuizType.MODULE and not self.module_id:
            raise ValueError("MODULE quiz must have module_id set")
        if self.quiz_type == QuizType.FINAL and not self.course_id:
            raise ValueError("FINAL quiz must have course_id set")
        return self


class QuizCreate(QuizBase):
    pass


class QuizUpdate(CoreBaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    passing_score: Optional[Decimal] = Field(None, ge=Decimal("0.00"), le=Decimal("100.00"))
    max_attempts: Optional[int] = Field(None, ge=1)
    time_limit_minutes: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None


class QuizResponse(QuizBase):
    id: uuid.UUID
    created_at: datetime
    questions: List[QuestionResponse] = []


class QuizPublicResponse(CoreBaseModel):
    """
    Assessment payload delivered to the student taking the quiz.
    """
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    quiz_type: QuizType
    passing_score: Decimal
    max_attempts: int
    time_limit_minutes: Optional[int] = None
    questions: List[QuestionPublicResponse] = []


# ---------------------------------------------------------------------------
# AI Quiz Draft Schemas
# ---------------------------------------------------------------------------
class AIQuizDraftBase(CoreBaseModel):
    lesson_id: uuid.UUID
    prompt_context: Optional[str] = None
    raw_llm_response: Any


class AIQuizDraftCreate(AIQuizDraftBase):
    pass


class AIQuizDraftUpdate(CoreBaseModel):
    raw_llm_response: Optional[Any] = None
    status: Optional[AIDraftStatus] = None


class AIQuizDraftResponse(AIQuizDraftBase):
    id: uuid.UUID
    instructor_id: Optional[uuid.UUID] = None
    status: AIDraftStatus
    created_at: datetime
    reviewed_at: Optional[datetime] = None
