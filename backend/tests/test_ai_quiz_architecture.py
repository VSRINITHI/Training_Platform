import uuid
from decimal import Decimal
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from fastapi import status
from sqlalchemy import text
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.course import Course, Module, Lesson
from app.models.taxonomy import Domain, SubDomain
from app.models.quiz import Quiz, Question, AIQuizDraft
from app.models.enums import UserRole, QuizType, AIDraftStatus
from app.core.dependencies import get_current_user
from app.schemas.quiz import GeneratedQuizPayload, GeneratedQuestion, GeneratedQuestionOption


@pytest.fixture
def instructor_owner(create_test_user):
    return create_test_user(role=UserRole.INSTRUCTOR, full_name="AI Quiz Test Instructor")


@pytest.fixture
def course_hierarchy(instructor_owner):
    db = SessionLocal()
    suffix = str(uuid.uuid4())[:8]
    domain = Domain(name=f"AI Quiz Dom {suffix}", slug=f"ai-quiz-dom-{suffix}")
    db.add(domain)
    db.commit()
    db.refresh(domain)

    sub_domain = SubDomain(
        domain_id=domain.id,
        name=f"AI Quiz Sub {suffix}",
        slug=f"ai-quiz-sub-{suffix}",
    )
    db.add(sub_domain)
    db.commit()
    db.refresh(sub_domain)

    course = Course(
        instructor_id=instructor_owner.id,
        sub_domain_id=sub_domain.id,
        title=f"AI Quiz Architecture {suffix}",
        slug=f"ai-quiz-arch-{suffix}",
        description="Comprehensive course testing AI quiz architecture",
        is_published=True,
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    module = Module(
        course_id=course.id,
        title="Module 1: Foundations & Architecture",
        order_index=1,
    )
    db.add(module)
    db.commit()
    db.refresh(module)

    lesson = Lesson(
        module_id=module.id,
        title="Lesson 1.1: Core Concepts and Data Structures",
        order_index=1,
        content_body="Core concepts and data structures comprehensive lesson learning content text with over 100 characters.",
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    data = {
        "domain_id": domain.id,
        "sub_domain_id": sub_domain.id,
        "course_id": course.id,
        "module_id": module.id,
        "lesson_id": lesson.id,
    }
    db.close()

    yield data

    # Teardown & Clean up immediately
    db = SessionLocal()
    try:
        db.execute(text("DELETE FROM ai_quiz_drafts WHERE lesson_id = :id"), {"id": data["lesson_id"]})
        db.execute(text("DELETE FROM courses WHERE id = :id"), {"id": data["course_id"]})
        db.execute(text("DELETE FROM sub_domains WHERE id = :id"), {"id": data["sub_domain_id"]})
        db.execute(text("DELETE FROM domains WHERE id = :id"), {"id": data["domain_id"]})
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def test_ai_selective_grounding_and_course_final_exam(
    client: TestClient, instructor_owner, course_hierarchy
):
    course_id = str(course_hierarchy["course_id"])
    module_id = str(course_hierarchy["module_id"])
    lesson_id = str(course_hierarchy["lesson_id"])

    mock_generated = GeneratedQuizPayload(
        questions=[
            GeneratedQuestion(
                question_text="What is a Python generator and how does yield work?",
                question_type="MCQ",
                points=2,
                explanation="Generators produce values lazily using yield.",
                options=[
                    GeneratedQuestionOption(option_text="Yield pauses function execution and emits a value", is_correct=True),
                    GeneratedQuestionOption(option_text="Yield terminates the entire Python process", is_correct=False),
                    GeneratedQuestionOption(option_text="Yield converts lists into dictionaries", is_correct=False),
                ],
            )
        ]
    )
    raw_dict = mock_generated.model_dump(mode="json")

    app.dependency_overrides[get_current_user] = lambda: instructor_owner
    try:
        with patch("app.api.v1.endpoints.quizzes.generate_quiz_questions", return_value=(mock_generated, raw_dict)):
            # 1. Test Module AI generate with selective lesson grounding
            res_mod_gen = client.post(
                f"/api/v1/modules/{module_id}/ai-generate",
                json={
                    "num_questions": 3,
                    "difficulty": "INTERMEDIATE",
                    "lesson_ids": [lesson_id],
                },
                headers={"Authorization": "Bearer token"},
            )
            assert res_mod_gen.status_code == status.HTTP_201_CREATED
            mod_draft = res_mod_gen.json()
            assert mod_draft["status"] == "PENDING_REVIEW"
            assert mod_draft["lesson_id"] == lesson_id

            # 2. Test Course Final Assessment AI generate with selective module grounding
            res_course_gen = client.post(
                f"/api/v1/courses/{course_id}/ai-generate",
                json={
                    "num_questions": 5,
                    "difficulty": "ADVANCED",
                    "module_ids": [module_id],
                },
                headers={"Authorization": "Bearer token"},
            )
            assert res_course_gen.status_code == status.HTTP_201_CREATED
            course_draft = res_course_gen.json()
            assert course_draft["status"] == "PENDING_REVIEW"

            # 3. Approve Course Draft into Final Certification Exam
            draft_id = course_draft["id"]
            res_rev = client.post(
                f"/api/v1/ai-drafts/{draft_id}/review",
                json={
                    "status": "APPROVED",
                    "import_to_quiz": True,
                    "target_type": "FINAL",
                    "target_id": course_id,
                },
                headers={"Authorization": "Bearer token"},
            )
            assert res_rev.status_code == status.HTTP_200_OK
            rev_data = res_rev.json()
            assert rev_data["status"] == "APPROVED"

            # 4. Query course final quiz endpoint
            res_final_quiz = client.get(
                f"/api/v1/courses/{course_id}/final-quiz",
                headers={"Authorization": "Bearer token"},
            )
            assert res_final_quiz.status_code == status.HTTP_200_OK
            final_data = res_final_quiz.json()
            assert final_data["quiz_type"] == "FINAL"
            assert len(final_data["questions"]) >= 1

            # 5. Query course detail endpoint - ensure final_quiz is present
            res_course_detail = client.get(
                f"/api/v1/courses/{course_id}",
                headers={"Authorization": "Bearer token"},
            )
            assert res_course_detail.status_code == status.HTTP_200_OK
            detail_data = res_course_detail.json()
            assert detail_data["final_quiz"] is not None
            assert detail_data["final_quiz"]["quiz_type"] == "FINAL"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
