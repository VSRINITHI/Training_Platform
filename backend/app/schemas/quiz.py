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
    order_index: Optional[int] = Field(default=None, ge=1)


class QuestionOptionCreate(QuestionOptionBase):
    pass


class QuestionOptionUpdate(CoreBaseModel):
    option_text: Optional[str] = Field(None, min_length=1)
    is_correct: Optional[bool] = None
    order_index: Optional[int] = Field(None, ge=1)


class QuestionOptionResponse(CoreBaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    option_text: str
    is_correct: bool
    order_index: int


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
    order_index: Optional[int] = Field(default=None, ge=1)


class QuestionCreate(QuestionBase):
    quiz_id: Optional[uuid.UUID] = None
    options: Optional[List[QuestionOptionCreate]] = None


class QuestionUpdate(CoreBaseModel):
    question_text: Optional[str] = Field(None, min_length=1)
    question_type: Optional[QuestionType] = None
    explanation: Optional[str] = None
    points: Optional[int] = Field(None, ge=1)
    order_index: Optional[int] = Field(None, ge=1)


class QuestionResponse(CoreBaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    question_text: str
    question_type: QuestionType
    explanation: Optional[str] = None
    points: int
    order_index: int
    options: List[QuestionOptionResponse] = []


class QuestionPublicResponse(CoreBaseModel):
    """
    Question representation for learners taking the quiz (answers & explanation hidden).
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
# AI Quiz Generation & Draft Schemas
# ---------------------------------------------------------------------------
class AIQuizGenerateRequest(CoreBaseModel):
    num_questions: int = Field(default=5, ge=1, le=20, description="Number of questions to generate (1-20)")
    difficulty: Optional[str] = Field(default="INTERMEDIATE", description="BEGINNER, INTERMEDIATE, or ADVANCED")
    question_types: Optional[List[str]] = Field(
        default=["MCQ", "TRUE_FALSE", "MULTI_SELECT"],
        description="Allowed question types: MCQ, TRUE_FALSE, MULTI_SELECT",
    )
    custom_instructions: Optional[str] = Field(
        None, description="Optional custom instructions or focus areas for NVIDIA Llama"
    )
    source_materials: Optional[List[str]] = Field(
        None, description="Optional list of specific source material strings or document identifiers"
    )
    lesson_ids: Optional[List[uuid.UUID]] = Field(
        None, description="Selective list of lesson IDs to include for grounding"
    )
    module_ids: Optional[List[uuid.UUID]] = Field(
        None, description="Selective list of module IDs for course final exam generation"
    )
    document_urls: Optional[List[str]] = Field(
        None, description="Selective list of document URLs to include for grounding"
    )
    include_transcript: bool = Field(
        default=False, description="Whether to include video transcript if available"
    )


class GeneratedQuestionOption(CoreBaseModel):
    option_text: str = Field(..., min_length=1)
    is_correct: bool = Field(default=False)


class GeneratedQuestion(CoreBaseModel):
    question_text: str = Field(..., min_length=3)
    question_type: QuestionType = Field(default=QuestionType.MCQ)
    points: int = Field(default=1, ge=1)
    explanation: Optional[str] = Field(None)
    options: List[GeneratedQuestionOption] = Field(..., min_length=2)

    @model_validator(mode="after")
    def validate_options_and_answers(self) -> "GeneratedQuestion":
        if not self.options or len(self.options) < 2:
            raise ValueError("Each question must contain at least 2 options")
        correct_count = sum(1 for opt in self.options if opt.is_correct)
        if correct_count == 0:
            raise ValueError("At least one option must be marked as correct")
        if self.question_type in (QuestionType.MCQ, QuestionType.TRUE_FALSE) and correct_count > 1:
            # If multiple marked for single-choice, retain only the first marked correct
            first_found = False
            for opt in self.options:
                if opt.is_correct:
                    if first_found:
                        opt.is_correct = False
                    first_found = True
        return self


class GeneratedQuizPayload(CoreBaseModel):
    questions: List[GeneratedQuestion] = Field(..., min_length=1)


class AIQuizDraftBase(CoreBaseModel):
    lesson_id: uuid.UUID
    prompt_context: Optional[str] = None
    raw_llm_response: Any


class AIQuizDraftCreate(AIQuizDraftBase):
    pass


class AIQuizDraftUpdate(CoreBaseModel):
    raw_llm_response: Optional[Any] = None
    status: Optional[AIDraftStatus] = None


class AIQuizDraftReviewRequest(CoreBaseModel):
    status: AIDraftStatus = Field(..., description="APPROVED or DISCARDED")
    import_to_quiz: bool = Field(default=True, description="If APPROVED, import questions into the quiz")
    target_type: Optional[QuizType] = Field(
        default=None, description="Target quiz type: LESSON, MODULE, or FINAL (defaults to LESSON)"
    )
    target_id: Optional[uuid.UUID] = Field(
        default=None, description="Target lesson_id, module_id, or course_id depending on target_type"
    )
    target_quiz_id: Optional[uuid.UUID] = Field(
        default=None, description="Direct target quiz ID if appending to an existing quiz"
    )


class AIQuizDraftResponse(AIQuizDraftBase):
    id: uuid.UUID
    instructor_id: Optional[uuid.UUID] = None
    status: AIDraftStatus
    created_at: datetime
    reviewed_at: Optional[datetime] = None
