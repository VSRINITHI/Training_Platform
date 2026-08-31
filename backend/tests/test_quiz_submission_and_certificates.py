import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.models.user import User
from app.models.taxonomy import Domain, SubDomain
from app.models.course import Course, Module, Lesson
from app.models.quiz import Quiz, Question, QuestionOption
from app.models.enrollment import Enrollment, ModuleProgress, LessonProgress
from app.models.assessment import QuizAttempt, Certificate
from app.models.enums import (
    UserRole,
    DifficultyLevel,
    EnrollmentStatus,
    ModuleProgressStatus,
    QuizType,
    QuestionType,
)
from app.core.dependencies import get_current_user
from app.core.database import SessionLocal
from app.main import app


@pytest.fixture
def instructor_user(create_test_user):
    return create_test_user(role=UserRole.INSTRUCTOR, full_name="Assessment Instructor")


@pytest.fixture
def regular_user(create_test_user):
    return create_test_user(role=UserRole.USER, full_name="Assessment Learner 1")


@pytest.fixture
def second_user(create_test_user):
    return create_test_user(role=UserRole.USER, full_name="Assessment Learner 2")


@pytest.fixture
def admin_user(create_test_user):
    return create_test_user(role=UserRole.ADMIN, full_name="Assessment Admin")


@pytest.fixture
def assessment_setup(instructor_user, regular_user, second_user, admin_user):
    """
    Creates a full course curriculum hierarchy with domain, sub-domain, course, modules,
    lessons, module quiz, lesson quiz, and final exam quiz.
    """
    db_session = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    try:
        # 1. Taxonomy
        domain = Domain(name=f"Assessment Domain {suffix}", slug=f"assess-domain-{suffix}")
        db_session.add(domain)
        db_session.commit()
        db_session.refresh(domain)

        sub_domain = SubDomain(domain_id=domain.id, name=f"Assessment SubDomain {suffix}", slug=f"assess-sub-{suffix}")
        db_session.add(sub_domain)
        db_session.commit()
        db_session.refresh(sub_domain)

        # 2. Course
        course = Course(
            instructor_id=instructor_user.id,
            sub_domain_id=sub_domain.id,
            title="Comprehensive Python Mastery",
            slug=f"python-mastery-{suffix}",
            description="Complete Python from beginner to advanced.",
            difficulty_level=DifficultyLevel.INTERMEDIATE,
            is_published=True,
        )
        db_session.add(course)
        db_session.commit()
        db_session.refresh(course)

        # 3. Modules
        module1 = Module(
            course_id=course.id,
            title="Module 1: Basics",
            order_index=1,
            is_required=True,
        )
        module2 = Module(
            course_id=course.id,
            title="Module 2: Advanced",
            order_index=2,
            is_required=True,
        )
        db_session.add_all([module1, module2])
        db_session.commit()
        db_session.refresh(module1)
        db_session.refresh(module2)

        # 4. Lessons for Module 1
        lesson1 = Lesson(
            module_id=module1.id,
            title="Lesson 1: Syntax & Variables",
            order_index=1,
            duration_minutes=15,
            content_body="Variables store data.",
        )
        lesson2 = Lesson(
            module_id=module1.id,
            title="Lesson 2: Control Flow",
            order_index=2,
            duration_minutes=20,
            content_body="If and loops control execution.",
        )
        db_session.add_all([lesson1, lesson2])
        db_session.commit()
        db_session.refresh(lesson1)
        db_session.refresh(lesson2)

        # 5. Module 1 Quiz (with MCQ, TRUE_FALSE, and MULTI_SELECT questions)
        mod1_quiz = Quiz(
            title="Module 1 Assessment",
            quiz_type=QuizType.MODULE,
            module_id=module1.id,
            passing_score=Decimal("75.00"),
            max_attempts=3,
            is_active=True,
        )
        db_session.add(mod1_quiz)
        db_session.commit()
        db_session.refresh(mod1_quiz)

        # Question 1: MCQ (1 point)
        q1 = Question(
            quiz_id=mod1_quiz.id,
            question_text="What is the output of print(2 + 2)?",
            question_type=QuestionType.MCQ,
            explanation="2 + 2 equals 4.",
            points=1,
            order_index=1,
        )
        db_session.add(q1)
        db_session.commit()
        db_session.refresh(q1)

        q1_opt1 = QuestionOption(question_id=q1.id, option_text="3", is_correct=False, order_index=1)
        q1_opt2 = QuestionOption(question_id=q1.id, option_text="4", is_correct=True, order_index=2)
        q1_opt3 = QuestionOption(question_id=q1.id, option_text="5", is_correct=False, order_index=3)
        db_session.add_all([q1_opt1, q1_opt2, q1_opt3])
        db_session.commit()
        db_session.refresh(q1_opt1)
        db_session.refresh(q1_opt2)
        db_session.refresh(q1_opt3)

        # Question 2: TRUE_FALSE (1 point)
        q2 = Question(
            quiz_id=mod1_quiz.id,
            question_text="Python is a dynamically typed language.",
            question_type=QuestionType.TRUE_FALSE,
            explanation="Python determines variable types at runtime.",
            points=1,
            order_index=2,
        )
        db_session.add(q2)
        db_session.commit()
        db_session.refresh(q2)

        q2_opt1 = QuestionOption(question_id=q2.id, option_text="True", is_correct=True, order_index=1)
        q2_opt2 = QuestionOption(question_id=q2.id, option_text="False", is_correct=False, order_index=2)
        db_session.add_all([q2_opt1, q2_opt2])
        db_session.commit()
        db_session.refresh(q2_opt1)
        db_session.refresh(q2_opt2)

        # Question 3: MULTI_SELECT (2 points)
        q3 = Question(
            quiz_id=mod1_quiz.id,
            question_text="Which of the following are mutable built-in types in Python?",
            question_type=QuestionType.MULTI_SELECT,
            explanation="Lists and Dictionaries are mutable, while Tuples and Integers are immutable.",
            points=2,
            order_index=3,
        )
        db_session.add(q3)
        db_session.commit()
        db_session.refresh(q3)

        q3_opt1 = QuestionOption(question_id=q3.id, option_text="List", is_correct=True, order_index=1)
        q3_opt2 = QuestionOption(question_id=q3.id, option_text="Dictionary", is_correct=True, order_index=2)
        q3_opt3 = QuestionOption(question_id=q3.id, option_text="Tuple", is_correct=False, order_index=3)
        q3_opt4 = QuestionOption(question_id=q3.id, option_text="Integer", is_correct=False, order_index=4)
        db_session.add_all([q3_opt1, q3_opt2, q3_opt3, q3_opt4])
        db_session.commit()
        db_session.refresh(q3_opt1)
        db_session.refresh(q3_opt2)
        db_session.refresh(q3_opt3)
        db_session.refresh(q3_opt4)

        # 6. Final Exam Quiz
        final_quiz = Quiz(
            title="Course Final Certification Exam",
            quiz_type=QuizType.FINAL,
            course_id=course.id,
            passing_score=Decimal("70.00"),
            max_attempts=2,
            is_active=True,
        )
        db_session.add(final_quiz)
        db_session.commit()
        db_session.refresh(final_quiz)

        fq1 = Question(
            quiz_id=final_quiz.id,
            question_text="Is Python open-source?",
            question_type=QuestionType.TRUE_FALSE,
            explanation="Python is developed under an OSI-approved open source license.",
            points=1,
            order_index=1,
        )
        db_session.add(fq1)
        db_session.commit()
        db_session.refresh(fq1)

        fq1_opt1 = QuestionOption(question_id=fq1.id, option_text="True", is_correct=True, order_index=1)
        fq1_opt2 = QuestionOption(question_id=fq1.id, option_text="False", is_correct=False, order_index=2)
        db_session.add_all([fq1_opt1, fq1_opt2])
        db_session.commit()
        db_session.refresh(fq1_opt1)
        db_session.refresh(fq1_opt2)

        return {
            "course_id": course.id,
            "course_title": course.title,
            "module1_id": module1.id,
            "module2_id": module2.id,
            "lesson1_id": lesson1.id,
            "lesson2_id": lesson2.id,
            "mod1_quiz_id": mod1_quiz.id,
            "q1_id": q1.id,
            "q1_opts": {"3": q1_opt1.id, "4": q1_opt2.id, "5": q1_opt3.id},
            "q2_id": q2.id,
            "q2_opts": {"True": q2_opt1.id, "False": q2_opt2.id},
            "q3_id": q3.id,
            "q3_opts": {"List": q3_opt1.id, "Dictionary": q3_opt2.id, "Tuple": q3_opt3.id, "Integer": q3_opt4.id},
            "final_quiz_id": final_quiz.id,
            "fq1_id": fq1.id,
            "fq1_opts": {"True": fq1_opt1.id, "False": fq1_opt2.id},
            "instructor_user": instructor_user,
            "regular_user": regular_user,
            "second_user": second_user,
            "admin_user": admin_user,
        }
    finally:
        db_session.close()


def test_quiz_submission_and_scoring_engine(client: TestClient, assessment_setup):
    setup = assessment_setup
    user = setup["regular_user"]
    course_id = setup["course_id"]
    quiz_id = setup["mod1_quiz_id"]
    q1_id = setup["q1_id"]
    q2_id = setup["q2_id"]
    q3_id = setup["q3_id"]
    opts1 = setup["q1_opts"]
    opts2 = setup["q2_opts"]
    opts3 = setup["q3_opts"]

    # 1. Unenrolled learner cannot submit quiz
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        res = client.post(
            f"/api/v1/quizzes/{quiz_id}/submit",
            json={"answers": [{"question_id": str(q1_id), "selected_option_ids": [str(opts1["4"])]}]},
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

        # 2. Enroll learner
        enroll_res = client.post("/api/v1/enrollments", json={"course_id": str(course_id)})
        assert enroll_res.status_code == status.HTTP_201_CREATED

        # 3. Submit quiz with all correct answers (100%)
        # Q1: 4 (1pt), Q2: True (1pt), Q3: List + Dictionary (2pts) -> Total 4/4 = 100%
        perfect_submission = {
            "answers": [
                {"question_id": str(q1_id), "selected_option_ids": [str(opts1["4"])]},
                {"question_id": str(q2_id), "selected_option_ids": [str(opts2["True"])]},
                {"question_id": str(q3_id), "selected_option_ids": [str(opts3["List"]), str(opts3["Dictionary"])]},
            ]
        }
        res = client.post(f"/api/v1/quizzes/{quiz_id}/submit", json=perfect_submission)
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["attempt_number"] == 1
        assert data["attempt_cycle"] == 1
        assert Decimal(str(data["score_achieved"])) == Decimal("100.00")
        assert data["is_passed"] is True
        assert data["relearning_triggered"] is False
        assert len(data["question_results"]) == 3

        # Check results content includes explanations and correct options
        for qr in data["question_results"]:
            assert qr["is_correct"] is True
            assert qr["explanation"] is not None

        # Check attempt history
        attempts_res = client.get(f"/api/v1/quizzes/{quiz_id}/attempts")
        assert attempts_res.status_code == status.HTTP_200_OK
        assert len(attempts_res.json()) == 1
        assert attempts_res.json()[0]["attempt_number"] == 1

        # Check single attempt detail
        attempt_id = data["attempt_id"]
        detail_res = client.get(f"/api/v1/attempts/{attempt_id}")
        assert detail_res.status_code == status.HTTP_200_OK
        assert detail_res.json()["score_achieved"] == "100.00"

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_relearning_lifecycle_and_cycle_tracking(client: TestClient, assessment_setup):
    setup = assessment_setup
    user = setup["second_user"]
    course_id = setup["course_id"]
    module1_id = setup["module1_id"]
    quiz_id = setup["mod1_quiz_id"]
    q1_id = setup["q1_id"]
    q2_id = setup["q2_id"]
    q3_id = setup["q3_id"]
    opts1 = setup["q1_opts"]
    opts2 = setup["q2_opts"]
    opts3 = setup["q3_opts"]

    app.dependency_overrides[get_current_user] = lambda: user
    try:
        # Enroll user
        client.post("/api/v1/enrollments", json={"course_id": str(course_id)})

        # Prepare failing answers (0% score)
        wrong_submission = {
            "answers": [
                {"question_id": str(q1_id), "selected_option_ids": [str(opts1["3"])]},
                {"question_id": str(q2_id), "selected_option_ids": [str(opts2["False"])]},
                {"question_id": str(q3_id), "selected_option_ids": [str(opts3["Tuple"])]},
            ]
        }

        # Attempt 1: Fail (attempts_used -> 1)
        r1 = client.post(f"/api/v1/quizzes/{quiz_id}/submit", json=wrong_submission)
        assert r1.status_code == status.HTTP_200_OK
        assert r1.json()["attempt_number"] == 1
        assert r1.json()["attempt_cycle"] == 1
        assert r1.json()["is_passed"] is False
        assert r1.json()["relearning_triggered"] is False

        # Attempt 2: Fail (attempts_used -> 2)
        r2 = client.post(f"/api/v1/quizzes/{quiz_id}/submit", json=wrong_submission)
        assert r2.status_code == status.HTTP_200_OK
        assert r2.json()["attempt_number"] == 2
        assert r2.json()["attempt_cycle"] == 1
        assert r2.json()["is_passed"] is False
        assert r2.json()["relearning_triggered"] is False

        # Attempt 3: Fail (attempts_used -> 3 == max_attempts -> triggers NEEDS_RELEARNING)
        r3 = client.post(f"/api/v1/quizzes/{quiz_id}/submit", json=wrong_submission)
        assert r3.status_code == status.HTTP_200_OK
        assert r3.json()["attempt_number"] == 3
        assert r3.json()["attempt_cycle"] == 1
        assert r3.json()["is_passed"] is False
        assert r3.json()["relearning_triggered"] is True

        # Attempt 4 without reset should be blocked with 400
        r4 = client.post(f"/api/v1/quizzes/{quiz_id}/submit", json=wrong_submission)
        assert r4.status_code == status.HTTP_400_BAD_REQUEST
        assert "NEEDS_RELEARNING" in r4.json()["detail"]

        # Reset module for relearning
        reset_res = client.post(f"/api/v1/modules/{module1_id}/relearning/reset")
        assert reset_res.status_code == status.HTTP_200_OK
        assert "reset to in-progress" in reset_res.json()["message"]

        # Attempt 4 after reset: Cycle increments to 2, attempt_number is 4!
        # Now submit passing answers (Q1: 4 (1pt), Q2: True (1pt), Q3: List + Dict (2pts) -> 4/4 = 100%)
        pass_submission = {
            "answers": [
                {"question_id": str(q1_id), "selected_option_ids": [str(opts1["4"])]},
                {"question_id": str(q2_id), "selected_option_ids": [str(opts2["True"])]},
                {"question_id": str(q3_id), "selected_option_ids": [str(opts3["List"]), str(opts3["Dictionary"])]},
            ]
        }
        r_cycle2 = client.post(f"/api/v1/quizzes/{quiz_id}/submit", json=pass_submission)
        assert r_cycle2.status_code == status.HTTP_200_OK
        data_c2 = r_cycle2.json()
        assert data_c2["attempt_number"] == 4
        assert data_c2["attempt_cycle"] == 2
        assert data_c2["is_passed"] is True

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_certificate_issuance_and_public_verification(client: TestClient, assessment_setup):
    setup = assessment_setup
    user = setup["regular_user"]
    course_id = setup["course_id"]
    course_title = setup["course_title"]
    module1_id = setup["module1_id"]
    module2_id = setup["module2_id"]
    final_quiz_id = setup["final_quiz_id"]
    fq1_id = setup["fq1_id"]
    fq1_opts = setup["fq1_opts"]

    app.dependency_overrides[get_current_user] = lambda: user
    try:
        # 1. Unenrolled user cannot claim certificate -> 403
        unenrolled_claim = client.post(f"/api/v1/courses/{course_id}/certificate")
        assert unenrolled_claim.status_code == status.HTTP_403_FORBIDDEN

        # Enroll user in course
        client.post("/api/v1/enrollments", json={"course_id": str(course_id)})

        # 2. Ineligible claim before completing modules & final exam -> 400
        claim_res = client.post(f"/api/v1/courses/{course_id}/certificate")
        assert claim_res.status_code == status.HTTP_400_BAD_REQUEST
        assert "ineligible" in claim_res.json()["detail"].lower()

        # 2. Complete Module 1 & Module 2 progress
        db = SessionLocal()
        try:
            enrollment = db.query(Enrollment).filter(Enrollment.user_id == user.id, Enrollment.course_id == course_id).first()
            if not enrollment:
                client.post("/api/v1/enrollments", json={"course_id": str(course_id)})
                enrollment = db.query(Enrollment).filter(Enrollment.user_id == user.id, Enrollment.course_id == course_id).first()

            for mid in [module1_id, module2_id]:
                mp = db.query(ModuleProgress).filter(ModuleProgress.enrollment_id == enrollment.id, ModuleProgress.module_id == mid).first()
                if not mp:
                    mp = ModuleProgress(enrollment_id=enrollment.id, module_id=mid, status=ModuleProgressStatus.COMPLETED)
                    db.add(mp)
                else:
                    mp.status = ModuleProgressStatus.COMPLETED
            db.commit()
        finally:
            db.close()

        # 3. Final exam is now unlocked -> submit passing final exam
        final_submission = {
            "answers": [
                {"question_id": str(fq1_id), "selected_option_ids": [str(fq1_opts["True"])]},
            ]
        }
        exam_res = client.post(f"/api/v1/quizzes/{final_quiz_id}/submit", json=final_submission)
        assert exam_res.status_code == status.HTTP_200_OK
        assert exam_res.json()["is_passed"] is True

        # 4. Claim Certificate
        cert_res = client.post(f"/api/v1/courses/{course_id}/certificate")
        assert cert_res.status_code == status.HTTP_200_OK
        cert_data = cert_res.json()
        assert cert_data["certificate_number"].startswith(f"DC-{datetime.now(timezone.utc).year}-")
        assert len(cert_data["verification_hash"]) == 64
        cert_num = cert_data["certificate_number"]
        cert_hash = cert_data["verification_hash"]
        cert_id = cert_data["id"]

        # 5. Idempotent re-claim returns identical certificate
        reclaim_res = client.post(f"/api/v1/courses/{course_id}/certificate")
        assert reclaim_res.status_code == status.HTTP_200_OK
        assert reclaim_res.json()["id"] == cert_id

        # 6. List my certificates
        my_certs_res = client.get("/api/v1/certificates/me")
        assert my_certs_res.status_code == status.HTTP_200_OK
        assert len(my_certs_res.json()) >= 1
        assert any(c["id"] == cert_id for c in my_certs_res.json())

        # 7. Get single certificate detail
        get_res = client.get(f"/api/v1/certificates/{cert_id}")
        assert get_res.status_code == status.HTTP_200_OK
        assert get_res.json()["certificate_number"] == cert_num

    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # 8. Public verification (No authentication dependency override)
    # Verify by Certificate Number
    v1 = client.get(f"/api/v1/certificates/verify/{cert_num}")
    assert v1.status_code == status.HTTP_200_OK
    v1_data = v1.json()
    assert v1_data["is_valid"] is True
    assert v1_data["certificate_number"] == cert_num
    assert v1_data["student_name"] == user.full_name
    assert v1_data["course_title"] == course_title

    # Verify by SHA-256 Hash
    v2 = client.get(f"/api/v1/certificates/verify/{cert_hash}")
    assert v2.status_code == status.HTTP_200_OK
    v2_data = v2.json()
    assert v2_data["is_valid"] is True
    assert v2_data["verification_hash"] == cert_hash

    # Verify invalid identifier returns is_valid=False
    v3 = client.get("/api/v1/certificates/verify/DC-FAKE-INVALID-HASH")
    assert v3.status_code == status.HTTP_200_OK
    assert v3.json()["is_valid"] is False
