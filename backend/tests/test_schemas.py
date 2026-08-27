import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest
from pydantic import ValidationError
import app.schemas as schemas
from app.models.enums import UserRole, QuizType, QuestionType, EnrollmentStatus, ModuleProgressStatus


def test_user_schemas():
    user_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    user_create = schemas.UserCreate(
        id=user_id,
        email="learner@example.com",
        full_name="Jane Doe",
        role=UserRole.USER,
    )
    assert user_create.id == user_id
    assert user_create.email == "learner@example.com"

    user_resp = schemas.UserResponse(
        id=user_id,
        email="learner@example.com",
        full_name="Jane Doe",
        role=UserRole.USER,
        created_at=now,
        updated_at=now,
    )
    assert user_resp.full_name == "Jane Doe"


def test_taxonomy_schemas():
    dom_id = uuid.uuid4()
    sub_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    sub_resp = schemas.SubDomainResponse(
        id=sub_id,
        domain_id=dom_id,
        name="Machine Learning",
        slug="machine-learning",
        description="ML Courses",
        created_at=now,
    )
    dom_resp = schemas.DomainWithSubDomainsResponse(
        id=dom_id,
        name="Software & IT",
        slug="software-it",
        created_at=now,
        sub_domains=[sub_resp],
    )
    assert len(dom_resp.sub_domains) == 1
    assert dom_resp.sub_domains[0].name == "Machine Learning"


def test_lesson_flexible_content_schema():
    # Video only
    l1 = schemas.LessonBase(
        title="Video Lesson",
        video_url="https://example.com/video.mp4",
        order_index=1,
    )
    assert l1.content_body is None
    assert l1.document_url is None
    assert l1.video_url == "https://example.com/video.mp4"

    # Document only
    l2 = schemas.LessonBase(
        title="Doc Lesson",
        document_url="https://example.com/file.pdf",
        order_index=2,
    )
    assert l2.video_url is None
    assert l2.document_url == "https://example.com/file.pdf"

    # All three
    l3 = schemas.LessonBase(
        title="Comprehensive Lesson",
        content_body="# Markdown Heading",
        video_url="https://example.com/video.mp4",
        document_url="https://example.com/file.pdf",
        order_index=3,
    )
    assert l3.content_body == "# Markdown Heading"


def test_quiz_schema_type_target_validation():
    # Valid LESSON quiz
    q1 = schemas.QuizCreate(
        title="Lesson 1 Quiz",
        quiz_type=QuizType.LESSON,
        lesson_id=uuid.uuid4(),
        passing_score=Decimal("80.00"),
        max_attempts=3,
    )
    assert q1.quiz_type == QuizType.LESSON

    # Invalid: LESSON quiz with module_id
    with pytest.raises(ValidationError):
        schemas.QuizCreate(
            title="Invalid Quiz",
            quiz_type=QuizType.LESSON,
            module_id=uuid.uuid4(),
            passing_score=Decimal("80.00"),
            max_attempts=3,
        )

    # Invalid: Multiple targets
    with pytest.raises(ValidationError):
        schemas.QuizCreate(
            title="Invalid Quiz",
            quiz_type=QuizType.MODULE,
            module_id=uuid.uuid4(),
            course_id=uuid.uuid4(),
            passing_score=Decimal("75.00"),
            max_attempts=3,
        )

    # Invalid: Zero targets
    with pytest.raises(ValidationError):
        schemas.QuizCreate(
            title="Invalid Quiz",
            quiz_type=QuizType.FINAL,
            passing_score=Decimal("70.00"),
            max_attempts=3,
        )


def test_question_option_public_schema_hides_correctness():
    opt_public = schemas.QuestionOptionPublicResponse(
        id=uuid.uuid4(),
        question_id=uuid.uuid4(),
        option_text="Option A",
        order_index=1,
    )
    assert not hasattr(opt_public, "is_correct")


def test_course_progress_schema():
    progress = schemas.CourseProgressResponse(
        enrollment_id=uuid.uuid4(),
        course_id=uuid.uuid4(),
        status=EnrollmentStatus.ACTIVE,
        total_required_modules=5,
        completed_required_modules=4,
        progress_pct=Decimal("80.00"),
        is_final_exam_unlocked=True,
        is_course_completed=False,
    )
    assert progress.progress_pct == Decimal("80.00")
    assert progress.is_final_exam_unlocked is True


def test_quiz_attempt_schema_cycle_tracking():
    attempt = schemas.QuizAttemptResponse(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        quiz_id=uuid.uuid4(),
        attempt_number=4,
        attempt_cycle=2,
        score_achieved=Decimal("85.00"),
        is_passed=True,
        submitted_answers=[{"question_id": str(uuid.uuid4()), "selected_option_ids": [str(uuid.uuid4())]}],
        started_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
    )
    assert attempt.attempt_number == 4
    assert attempt.attempt_cycle == 2
    assert attempt.is_passed is True
