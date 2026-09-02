import uuid
from datetime import datetime, timezone
from decimal import Decimal
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from app.main import app
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.taxonomy import Domain, SubDomain
from app.models.course import Course, Module, Lesson
from app.models.quiz import Quiz, Question, QuestionOption, AIQuizDraft
from app.models.enums import UserRole, QuizType, QuestionType, AIDraftStatus
from app.core.database import SessionLocal


@pytest.fixture
def instructor_owner(create_test_user):
    return create_test_user(role=UserRole.INSTRUCTOR, full_name="Quiz Instructor Owner")


@pytest.fixture
def instructor_other(create_test_user):
    return create_test_user(role=UserRole.INSTRUCTOR, full_name="Other Instructor")


@pytest.fixture
def learner_user(create_test_user):
    return create_test_user(role=UserRole.USER, full_name="Learner Taking Quiz")


@pytest.fixture
def admin_user(create_test_user):
    return create_test_user(role=UserRole.ADMIN, full_name="Admin Quiz Manager")


@pytest.fixture
def course_hierarchy(instructor_owner):
    db = SessionLocal()
    suffix = str(uuid.uuid4())[:8]
    domain = Domain(name=f"Quiz Domain {suffix}", slug=f"quiz-dom-{suffix}")
    db.add(domain)
    db.commit()
    db.refresh(domain)

    sub_domain = SubDomain(
        domain_id=domain.id,
        name=f"Quiz SubDomain {suffix}",
        slug=f"quiz-sub-{suffix}",
    )
    db.add(sub_domain)
    db.commit()
    db.refresh(sub_domain)

    course = Course(
        instructor_id=instructor_owner.id,
        sub_domain_id=sub_domain.id,
        title=f"Assessment Mastery {suffix}",
        slug=f"assessment-mastery-{suffix}",
        description="Comprehensive course testing quizzes",
        is_published=True,
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    module = Module(
        course_id=course.id,
        title="Module 1: Foundations",
        order_index=1,
    )
    db.add(module)
    db.commit()
    db.refresh(module)

    lesson = Lesson(
        module_id=module.id,
        title="Lesson 1.1: Core Concepts",
        order_index=1,
        content_body="Core concepts content",
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

    # Teardown
    db = SessionLocal()
    try:
        from sqlalchemy import text
        db.execute(text("DELETE FROM ai_quiz_drafts WHERE lesson_id = :id"), {"id": data["lesson_id"]})
        db.execute(text("DELETE FROM courses WHERE id = :id"), {"id": data["course_id"]})
        db.execute(text("DELETE FROM sub_domains WHERE id = :id"), {"id": data["sub_domain_id"]})
        db.execute(text("DELETE FROM domains WHERE id = :id"), {"id": data["domain_id"]})
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def test_quiz_crud_and_answer_masking(
    client: TestClient, instructor_owner, instructor_other, learner_user, admin_user, course_hierarchy
):
    module_id = str(course_hierarchy["module_id"])
    lesson_id = str(course_hierarchy["lesson_id"])

    # 1. Instructor Owner creates a Module Assessment Quiz
    app.dependency_overrides[get_current_user] = lambda: instructor_owner
    try:
        # First verify LESSON quiz is rejected
        res_lesson_rej = client.post(
            "/api/v1/quizzes",
            json={
                "title": "Lesson Quiz Rejection Test",
                "quiz_type": "LESSON",
                "lesson_id": lesson_id,
                "passing_score": "80.00",
            },
            headers={"Authorization": "Bearer token"},
        )
        assert res_lesson_rej.status_code == status.HTTP_400_BAD_REQUEST

        quiz_payload = {
            "title": "Module 1 Assessment Checkpoint",
            "quiz_type": "MODULE",
            "module_id": module_id,
            "passing_score": "80.00",
            "max_attempts": 2,
            "time_limit_minutes": 15,
            "is_active": True,
        }
        res_create = client.post(
            "/api/v1/quizzes",
            json=quiz_payload,
            headers={"Authorization": "Bearer token"},
        )
        assert res_create.status_code == status.HTTP_201_CREATED
        quiz_data = res_create.json()
        quiz_id = quiz_data["id"]

        # 2. Add Question with 3 options (one correct, two incorrect)
        question_payload = {
            "question_text": "What is the primary purpose of data normalization?",
            "question_type": "MCQ",
            "explanation": "Normalization reduces redundancy and improves data integrity.",
            "points": 2,
            "options": [
                {"option_text": "To reduce data redundancy", "is_correct": True},
                {"option_text": "To increase storage space", "is_correct": False},
                {"option_text": "To slow down read queries", "is_correct": False},
            ],
        }
        res_q = client.post(
            f"/api/v1/quizzes/{quiz_id}/questions",
            json=question_payload,
            headers={"Authorization": "Bearer token"},
        )
        assert res_q.status_code == status.HTTP_201_CREATED
        q_data = res_q.json()
        question_id = q_data["id"]
        assert len(q_data["options"]) == 3

        # 3. Add an extra option to the question
        res_opt = client.post(
            f"/api/v1/quizzes/questions/{question_id}/options",
            json={"option_text": "To delete all tables", "is_correct": False},
            headers={"Authorization": "Bearer token"},
        )
        assert res_opt.status_code == status.HTTP_201_CREATED
        opt_id = res_opt.json()["id"]

        # 4. CRITICAL TEST: Learner Public View MUST MASK answers and explanation
        app.dependency_overrides.pop(get_current_user, None)  # Learner / Public
        res_public = client.get(f"/api/v1/quizzes/{quiz_id}")
        assert res_public.status_code == status.HTTP_200_OK
        pub_data = res_public.json()
        assert len(pub_data["questions"]) == 1
        pub_q = pub_data["questions"][0]
        # Verify explanation is NOT present
        assert "explanation" not in pub_q
        # Verify is_correct is NOT present in any option
        assert len(pub_q["options"]) == 4
        for opt in pub_q["options"]:
            assert "is_correct" not in opt
            assert "option_text" in opt

        # 5. Authoring view contains is_correct and explanation
        app.dependency_overrides[get_current_user] = lambda: instructor_owner
        res_auth = client.get(
            f"/api/v1/quizzes/{quiz_id}/authoring",
            headers={"Authorization": "Bearer token"},
        )
        assert res_auth.status_code == status.HTTP_200_OK
        auth_data = res_auth.json()
        auth_q = auth_data["questions"][0]
        assert auth_q["explanation"] == "Normalization reduces redundancy and improves data integrity."
        assert any(o["is_correct"] is True for o in auth_q["options"])

        # 6. Unauthorized instructor cannot edit quiz
        app.dependency_overrides[get_current_user] = lambda: instructor_other
        res_unauth = client.patch(
            f"/api/v1/quizzes/{quiz_id}",
            json={"title": "Hacked Title"},
            headers={"Authorization": "Bearer token"},
        )
        assert res_unauth.status_code == status.HTTP_403_FORBIDDEN

        # 7. Delete extra option
        app.dependency_overrides[get_current_user] = lambda: instructor_owner
        res_del_opt = client.delete(
            f"/api/v1/quizzes/options/{opt_id}",
            headers={"Authorization": "Bearer token"},
        )
        assert res_del_opt.status_code == status.HTTP_200_OK

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_ai_draft_quarantine_and_review_workflow(
    client: TestClient, instructor_owner, instructor_other, course_hierarchy
):
    lesson_id = str(course_hierarchy["lesson_id"])

    # 1. Instructor generates AI quiz draft into QUARANTINE
    # Include string "false" and "true" to verify safe boolean parsing
    app.dependency_overrides[get_current_user] = lambda: instructor_owner
    try:
        raw_llm_json = {
            "questions": [
                {
                    "question_text": "Which layer in deep learning reduces overfitting?",
                    "question_type": "MCQ",
                    "explanation": "Dropout randomly deactivates neurons during training.",
                    "points": 1,
                    "options": [
                        {"option_text": "Dropout layer", "is_correct": "true"},
                        {"option_text": "Linear layer", "is_correct": "false"},
                        {"option_text": "Flatten layer", "is_correct": False},
                    ],
                }
            ]
        }
        draft_payload = {
            "lesson_id": lesson_id,
            "prompt_context": "Generate questions on neural network regularization",
            "raw_llm_response": raw_llm_json,
        }
        res_draft = client.post(
            f"/api/v1/lessons/{lesson_id}/ai-drafts",
            json=draft_payload,
            headers={"Authorization": "Bearer token"},
        )
        assert res_draft.status_code == status.HTTP_201_CREATED
        draft_data = res_draft.json()
        draft_id = draft_data["id"]
        assert draft_data["status"] == "PENDING_REVIEW"
        assert draft_data["reviewed_at"] is None

        # 2. List drafts
        res_list = client.get(
            f"/api/v1/lessons/{lesson_id}/ai-drafts",
            headers={"Authorization": "Bearer token"},
        )
        assert res_list.status_code == status.HTTP_200_OK
        assert len(res_list.json()) >= 1

        # 3. Other instructor cannot review draft (403)
        app.dependency_overrides[get_current_user] = lambda: instructor_other
        res_other_rev = client.post(
            f"/api/v1/ai-drafts/{draft_id}/review",
            json={"status": "APPROVED", "import_to_quiz": True},
            headers={"Authorization": "Bearer token"},
        )
        assert res_other_rev.status_code == status.HTTP_403_FORBIDDEN

        # 4. Owner approves draft & imports to quiz
        app.dependency_overrides[get_current_user] = lambda: instructor_owner
        res_review = client.post(
            f"/api/v1/ai-drafts/{draft_id}/review",
            json={"status": "APPROVED", "import_to_quiz": True},
            headers={"Authorization": "Bearer token"},
        )
        assert res_review.status_code == status.HTTP_200_OK
        reviewed_data = res_review.json()
        assert reviewed_data["status"] == "APPROVED"
        assert reviewed_data["reviewed_at"] is not None

        # 5. Reviewing the same draft again should FAIL with 400 Bad Request
        res_re_review = client.post(
            f"/api/v1/ai-drafts/{draft_id}/review",
            json={"status": "APPROVED", "import_to_quiz": True},
            headers={"Authorization": "Bearer token"},
        )
        assert res_re_review.status_code == status.HTTP_400_BAD_REQUEST
        assert "already been reviewed" in res_re_review.json()["detail"]

        # 6. Verify that the imported quiz, question, and options exist via authoring endpoint
        db = SessionLocal()
        try:
            module_id = str(course_hierarchy["module_id"])
            quiz = db.query(Quiz).filter(Quiz.module_id == uuid.UUID(module_id), Quiz.quiz_type == QuizType.MODULE).first()
            assert quiz is not None
            quiz_id = str(quiz.id)
        finally:
            db.close()

        res_authoring = client.get(
            f"/api/v1/quizzes/{quiz_id}/authoring",
            headers={"Authorization": "Bearer token"},
        )
        assert res_authoring.status_code == status.HTTP_200_OK
        quiz_data = res_authoring.json()
        assert len(quiz_data["questions"]) >= 1
        imported_q = next((q for q in quiz_data["questions"] if "reduces overfitting" in q["question_text"]), None)
        assert imported_q is not None
        assert imported_q["question_type"] == "MCQ"
        assert imported_q["explanation"] == "Dropout randomly deactivates neurons during training."
        assert len(imported_q["options"]) == 3

        # Verify safe boolean parsing on options
        opt_dropout = next((o for o in imported_q["options"] if o["option_text"] == "Dropout layer"), None)
        opt_linear = next((o for o in imported_q["options"] if o["option_text"] == "Linear layer"), None)
        opt_flatten = next((o for o in imported_q["options"] if o["option_text"] == "Flatten layer"), None)

        assert opt_dropout is not None and opt_dropout["is_correct"] is True
        assert opt_linear is not None and opt_linear["is_correct"] is False
        assert opt_flatten is not None and opt_flatten["is_correct"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)
