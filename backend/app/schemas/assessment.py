import uuid
from typing import List, Optional, Any
from datetime import datetime
from decimal import Decimal
from pydantic import Field
from app.schemas.common import CoreBaseModel


# ---------------------------------------------------------------------------
# Quiz Submission & Attempt Schemas
# ---------------------------------------------------------------------------
class QuizAnswerSubmit(CoreBaseModel):
    question_id: uuid.UUID
    selected_option_ids: List[uuid.UUID] = Field(..., min_length=1)


class QuizSubmissionRequest(CoreBaseModel):
    answers: List[QuizAnswerSubmit] = Field(..., min_length=1)


class QuestionResultResponse(CoreBaseModel):
    question_id: uuid.UUID
    is_correct: bool
    points_awarded: int
    max_points: int
    explanation: Optional[str] = None
    selected_option_ids: List[uuid.UUID]
    correct_option_ids: List[uuid.UUID]


class QuizAttemptResponse(CoreBaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    quiz_id: uuid.UUID
    module_progress_id: Optional[uuid.UUID] = None
    attempt_number: int
    attempt_cycle: int
    score_achieved: Decimal
    is_passed: bool
    submitted_answers: Any
    started_at: datetime
    submitted_at: datetime


class QuizSubmissionResultResponse(CoreBaseModel):
    attempt_id: uuid.UUID
    quiz_id: uuid.UUID
    attempt_number: int
    attempt_cycle: int
    score_achieved: Decimal
    passing_score: Decimal
    is_passed: bool
    relearning_triggered: bool = False
    question_results: List[QuestionResultResponse] = []


# ---------------------------------------------------------------------------
# Certificate Schemas
# ---------------------------------------------------------------------------
class CertificateClaimRequest(CoreBaseModel):
    course_id: uuid.UUID


class CertificateResponse(CoreBaseModel):
    id: uuid.UUID
    enrollment_id: uuid.UUID
    user_id: uuid.UUID
    course_id: uuid.UUID
    certificate_number: str
    issued_at: datetime
    pdf_storage_path: Optional[str] = None
    verification_hash: str


class CertificateVerifyResponse(CoreBaseModel):
    is_valid: bool
    certificate_number: Optional[str] = None
    student_name: Optional[str] = None
    course_title: Optional[str] = None
    issued_at: Optional[datetime] = None
    verification_hash: str
