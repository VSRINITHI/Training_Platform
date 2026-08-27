import pytest
from sqlalchemy import inspect
from app.core.database import SessionLocal, engine
import app.models as models


def test_all_16_models_exported():
    expected_models = [
        "User",
        "Domain",
        "SubDomain",
        "UserInterest",
        "Course",
        "Module",
        "Lesson",
        "Quiz",
        "Question",
        "QuestionOption",
        "AIQuizDraft",
        "Enrollment",
        "ModuleProgress",
        "LessonProgress",
        "QuizAttempt",
        "Certificate",
    ]
    for model_name in expected_models:
        assert hasattr(models, model_name), f"Model {model_name} missing from app.models"
        model_cls = getattr(models, model_name)
        assert hasattr(model_cls, "__tablename__"), f"Model {model_name} is not a valid ORM model"


def test_model_tablenames():
    expected_tables = {
        models.User: "users",
        models.Domain: "domains",
        models.SubDomain: "sub_domains",
        models.UserInterest: "user_interests",
        models.Course: "courses",
        models.Module: "modules",
        models.Lesson: "lessons",
        models.Quiz: "quizzes",
        models.Question: "questions",
        models.QuestionOption: "question_options",
        models.AIQuizDraft: "ai_quiz_drafts",
        models.Enrollment: "enrollments",
        models.ModuleProgress: "module_progress",
        models.LessonProgress: "lesson_progress",
        models.QuizAttempt: "quiz_attempts",
        models.Certificate: "certificates",
    }
    for model_cls, table_name in expected_tables.items():
        assert model_cls.__tablename__ == table_name


def test_models_map_to_live_database_tables():
    """
    Verifies that every model can be queried via SQLAlchemy session
    against the live Supabase PostgreSQL database without mapping errors.
    """
    db = SessionLocal()
    try:
        # Query each table (should return empty list or data without errors)
        assert db.query(models.User).limit(1).all() is not None
        assert db.query(models.Domain).limit(1).all() is not None
        assert db.query(models.SubDomain).limit(1).all() is not None
        assert db.query(models.UserInterest).limit(1).all() is not None
        assert db.query(models.Course).limit(1).all() is not None
        assert db.query(models.Module).limit(1).all() is not None
        assert db.query(models.Lesson).limit(1).all() is not None
        assert db.query(models.Quiz).limit(1).all() is not None
        assert db.query(models.Question).limit(1).all() is not None
        assert db.query(models.QuestionOption).limit(1).all() is not None
        assert db.query(models.AIQuizDraft).limit(1).all() is not None
        assert db.query(models.Enrollment).limit(1).all() is not None
        assert db.query(models.ModuleProgress).limit(1).all() is not None
        assert db.query(models.LessonProgress).limit(1).all() is not None
        assert db.query(models.QuizAttempt).limit(1).all() is not None
        assert db.query(models.Certificate).limit(1).all() is not None
    finally:
        db.close()


def test_banned_columns_not_in_models():
    """
    Verifies that no ORM model contains any banned attributes.
    """
    assert not hasattr(models.Course, "final_exam_id")
    assert not hasattr(models.Enrollment, "derived_progress_pct")
    assert not hasattr(models.ModuleProgress, "is_unlocked")
    assert not hasattr(models.Lesson, "content_type")


def test_lesson_model_content_attributes():
    """
    Verifies that Lesson model supports the flexible 3-field content structure.
    """
    mapper = inspect(models.Lesson)
    column_names = [c.key for c in mapper.columns]
    assert "content_body" in column_names
    assert "video_url" in column_names
    assert "document_url" in column_names
    assert "duration_minutes" in column_names
    assert "order_index" in column_names


def test_quiz_attempt_attributes():
    """
    Verifies that QuizAttempt model has attempt_number and attempt_cycle.
    """
    mapper = inspect(models.QuizAttempt)
    column_names = [c.key for c in mapper.columns]
    assert "attempt_number" in column_names
    assert "attempt_cycle" in column_names
    assert "score_achieved" in column_names
    assert "is_passed" in column_names
    assert "submitted_answers" in column_names
