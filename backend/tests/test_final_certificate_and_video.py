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
from app.core.storage import resolve_media_url, generate_signed_url, BUCKET_VIDEOS
from app.main import app


@pytest.fixture
def cert_video_setup(create_test_user):
    instructor = create_test_user(role=UserRole.INSTRUCTOR, full_name="Certificate Instructor")
    learner = create_test_user(role=UserRole.USER, full_name="Srinithi V.")
    other_learner = create_test_user(role=UserRole.USER, full_name="Other Learner")

    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    try:
        domain = Domain(name=f"Cert Domain {suffix}", slug=f"cert-domain-{suffix}")
        db.add(domain)
        db.commit()
        db.refresh(domain)

        sub_domain = SubDomain(domain_id=domain.id, name=f"Cert Sub {suffix}", slug=f"cert-sub-{suffix}")
        db.add(sub_domain)
        db.commit()
        db.refresh(sub_domain)

        course = Course(
            instructor_id=instructor.id,
            sub_domain_id=sub_domain.id,
            title=f"Python Programming Fundamentals {suffix}",
            slug=f"py-fund-{suffix}",
            description="Verified Python Mastercourse",
            difficulty_level=DifficultyLevel.BEGINNER,
            is_published=True,
            has_certificate=True,
        )
        db.add(course)
        db.commit()
        db.refresh(course)

        mod1 = Module(course_id=course.id, title="Module 1: Core", order_index=1, is_required=True)
        db.add(mod1)
        db.commit()
        db.refresh(mod1)

        les1 = Lesson(
            module_id=mod1.id,
            title="Lesson 1: Introduction",
            order_index=1,
            video_url="https://wbmimhdvyozohsofaurb.supabase.co/storage/v1/object/public/lesson-videos/b30472ab20ea4cda8c4381ead54d08e9.mp4",
            document_url="https://wbmimhdvyozohsofaurb.supabase.co/storage/v1/object/public/lesson-materials/test.pdf",
        )
        db.add(les1)
        db.commit()
        db.refresh(les1)

        # Module Checkpoint Quiz
        mod_quiz = Quiz(
            title="Module 1 Checkpoint",
            quiz_type=QuizType.MODULE,
            module_id=mod1.id,
            passing_score=Decimal("70.00"),
            max_attempts=2,
            is_active=True,
        )
        db.add(mod_quiz)
        db.commit()
        db.refresh(mod_quiz)

        mq1 = Question(quiz_id=mod_quiz.id, question_text="What is Python?", question_type=QuestionType.MCQ, points=10, order_index=1)
        db.add(mq1)
        db.commit()
        db.refresh(mq1)

        mopt1 = QuestionOption(question_id=mq1.id, option_text="A programming language", is_correct=True, order_index=1)
        mopt2 = QuestionOption(question_id=mq1.id, option_text="A snake only", is_correct=False, order_index=2)
        db.add_all([mopt1, mopt2])
        db.commit()
        db.refresh(mopt1)
        db.refresh(mopt2)

        # Final Exam Quiz
        final_quiz = Quiz(
            title="Final Certification Exam",
            quiz_type=QuizType.FINAL,
            course_id=course.id,
            passing_score=Decimal("70.00"),
            max_attempts=3,
            is_active=True,
        )
        db.add(final_quiz)
        db.commit()
        db.refresh(final_quiz)

        fq1 = Question(quiz_id=final_quiz.id, question_text="Is Python high-level?", question_type=QuestionType.TRUE_FALSE, points=10, order_index=1)
        db.add(fq1)
        db.commit()
        db.refresh(fq1)

        fopt1 = QuestionOption(question_id=fq1.id, option_text="True", is_correct=True, order_index=1)
        fopt2 = QuestionOption(question_id=fq1.id, option_text="False", is_correct=False, order_index=2)
        db.add_all([fopt1, fopt2])
        db.commit()
        db.refresh(fopt1)
        db.refresh(fopt2)

        data = {
            "instructor": instructor,
            "learner": learner,
            "other_learner": other_learner,
            "domain_id": domain.id,
            "sub_domain_id": sub_domain.id,
            "course_id": course.id,
            "course_title": course.title,
            "mod1_id": mod1.id,
            "les1_id": les1.id,
            "mod_quiz_id": mod_quiz.id,
            "mq1_id": mq1.id,
            "mopt1_id": mopt1.id,
            "mopt2_id": mopt2.id,
            "final_quiz_id": final_quiz.id,
            "fq1_id": fq1.id,
            "fopt1_id": fopt1.id,
            "fopt2_id": fopt2.id,
        }
    finally:
        db.close()

    yield data

    # Cleanup
    db_cleanup = SessionLocal()
    try:
        from sqlalchemy import text
        db_cleanup.execute(text("DELETE FROM certificates WHERE course_id = :id"), {"id": data["course_id"]})
        db_cleanup.execute(text("DELETE FROM quiz_attempts WHERE quiz_id IN (:q1, :q2)"), {"q1": data["mod_quiz_id"], "q2": data["final_quiz_id"]})
        db_cleanup.execute(text("DELETE FROM enrollments WHERE course_id = :id"), {"id": data["course_id"]})
        db_cleanup.execute(text("DELETE FROM courses WHERE id = :id"), {"id": data["course_id"]})
        db_cleanup.execute(text("DELETE FROM sub_domains WHERE id = :id"), {"id": data["sub_domain_id"]})
        db_cleanup.execute(text("DELETE FROM domains WHERE id = :id"), {"id": data["domain_id"]})
        db_cleanup.commit()
    except Exception:
        db_cleanup.rollback()
    finally:
        db_cleanup.close()


def test_video_signed_url_resolution(client: TestClient, cert_video_setup):
    """Verifies that lesson video URLs stored in private Supabase buckets resolve to signed URLs."""
    d = cert_video_setup
    res = client.get(f"/api/v1/lessons/{d['les1_id']}")
    assert res.status_code == status.HTTP_200_OK
    les_data = res.json()
    assert les_data["video_url"] is not None
    # Must contain signed token or valid accessible stream
    assert "token=" in les_data["video_url"] or "/static/" in les_data["video_url"]


def test_final_exam_completion_generates_certificate_and_prevents_duplicates(client: TestClient, cert_video_setup):
    """
    Verifies the complete flow:
    1. Learner enrolls
    2. Completes lesson and passes module checkpoint
    3. Failed final exam does NOT create certificate
    4. Passing final exam completes course and creates certificate
    5. Re-submitting or re-claiming returns existing certificate without duplicates
    6. Certificate verification endpoint publicly confirms authenticity
    """
    d = cert_video_setup
    learner = d["learner"]
    app.dependency_overrides[get_current_user] = lambda: learner

    # 1. Enroll
    r_enroll = client.post("/api/v1/enrollments", json={"course_id": str(d["course_id"])})
    assert r_enroll.status_code == status.HTTP_201_CREATED

    # 2. Complete Lesson 1
    r_les = client.post(f"/api/v1/lessons/{d['les1_id']}/progress", json={"is_completed": True})
    assert r_les.status_code == status.HTTP_200_OK

    # 3. Pass Module Checkpoint
    r_mod_quiz = client.post(
        f"/api/v1/quizzes/{d['mod_quiz_id']}/submit",
        json={"answers": [{"question_id": str(d["mq1_id"]), "selected_option_ids": [str(d["mopt1_id"])]}]},
    )
    assert r_mod_quiz.status_code == status.HTTP_200_OK
    assert r_mod_quiz.json()["is_passed"] is True

    # 4. Failed Final Exam Attempt (Wrong Answer) -> No Certificate Created
    r_fail_final = client.post(
        f"/api/v1/quizzes/{d['final_quiz_id']}/submit",
        json={"answers": [{"question_id": str(d["fq1_id"]), "selected_option_ids": [str(d["fopt2_id"])]}]},
    )
    assert r_fail_final.status_code == status.HTTP_200_OK
    assert r_fail_final.json()["is_passed"] is False

    # Check that no certificate was created
    r_certs_empty = client.get("/api/v1/certificates/me")
    assert r_certs_empty.status_code == status.HTTP_200_OK
    assert len([c for c in r_certs_empty.json() if c["course_id"] == str(d["course_id"])]) == 0

    # 5. Passing Final Exam Attempt (Correct Answer) -> Course COMPLETED and Certificate Created
    r_pass_final = client.post(
        f"/api/v1/quizzes/{d['final_quiz_id']}/submit",
        json={"answers": [{"question_id": str(d["fq1_id"]), "selected_option_ids": [str(d["fopt1_id"])]}]},
    )
    assert r_pass_final.status_code == status.HTTP_200_OK
    assert r_pass_final.json()["is_passed"] is True

    # 6. Retrieve Certificate
    r_certs = client.get("/api/v1/certificates/me")
    assert r_certs.status_code == status.HTTP_200_OK
    my_certs = r_certs.json()
    course_cert = next(c for c in my_certs if c["course_id"] == str(d["course_id"]))
    assert course_cert["certificate_number"].startswith("DC-")
    cert_num = course_cert["certificate_number"]

    # 7. Attempt Claim again -> Must return same certificate (Idempotent, No duplicate)
    r_claim = client.post(f"/api/v1/courses/{d['course_id']}/certificate")
    assert r_claim.status_code == status.HTTP_200_OK
    assert r_claim.json()["certificate_number"] == cert_num

    # 8. Public Verification Endpoint Test
    app.dependency_overrides.pop(get_current_user, None)
    r_verify = client.get(f"/api/v1/certificates/verify/{cert_num}")
    assert r_verify.status_code == status.HTTP_200_OK
    ver_data = r_verify.json()
    assert ver_data["is_valid"] is True
    assert ver_data["certificate_number"] == cert_num
    assert ver_data["student_name"] == "Srinithi V."
    assert d["course_title"] in ver_data["course_title"]
    assert ver_data["issued_at"] is not None


def test_certificate_view_and_verification_parity_and_invalid(client: TestClient, cert_video_setup):
    """
    Guarantees:
    1. A learner with alphanumeric roll number prefix (e.g. 727822TUAD054 SRINITHI.V)
       has their student ID stripped from both Certificate View and Public Verification.
    2. Both View and Verification resolve to the EXACT SAME course title.
    3. An invalid certificate number returns is_valid=False without leaking data.
    """
    d = cert_video_setup
    learner = d["learner"]
    # Temporarily set name with roll number
    db = SessionLocal()
    u = db.query(User).filter(User.id == learner.id).first()
    u.full_name = "727822TUAD054 SRINITHI.V"
    db.commit()
    db.close()

    app.dependency_overrides[get_current_user] = lambda: learner

    # Ensure certificate exists for this course
    db = SessionLocal()
    existing_cert = db.query(Certificate).filter(Certificate.user_id == learner.id, Certificate.course_id == d["course_id"]).first()
    if not existing_cert:
        enr = db.query(Enrollment).filter(Enrollment.user_id == learner.id, Enrollment.course_id == d["course_id"]).first()
        if not enr:
            enr = Enrollment(user_id=learner.id, course_id=d["course_id"], status=EnrollmentStatus.COMPLETED)
            db.add(enr)
            db.flush()
        existing_cert = Certificate(
            enrollment_id=enr.id,
            user_id=learner.id,
            course_id=d["course_id"],
            certificate_number=f"DC-2026-{uuid.uuid4().hex[:8].upper()}",
            verification_hash=uuid.uuid4().hex,
            issued_at=datetime.now(timezone.utc),
        )
        db.add(existing_cert)
        db.commit()
    cert_number = existing_cert.certificate_number
    db.close()

    # Get certificate view via API
    r_me = client.get("/api/v1/certificates/me")
    assert r_me.status_code == status.HTTP_200_OK
    view_data = next(c for c in r_me.json() if c["certificate_number"] == cert_number)

    # Assert clean recipient name on View
    assert view_data["student_name"] == "SRINITHI.V"
    assert "727822TUAD054" not in view_data["student_name"]
    assert view_data["course_title"] == d["course_title"]

    # Assert clean recipient name on Public Verification
    app.dependency_overrides.pop(get_current_user, None)
    r_verify = client.get(f"/api/v1/certificates/verify/{cert_number}")
    assert r_verify.status_code == status.HTTP_200_OK
    verify_data = r_verify.json()

    assert verify_data["is_valid"] is True
    assert verify_data["certificate_number"] == cert_number
    assert verify_data["student_name"] == "SRINITHI.V"
    assert "727822TUAD054" not in verify_data["student_name"]
    assert verify_data["course_title"] == d["course_title"]

    # Test Invalid Certificate lookup
    r_invalid = client.get("/api/v1/certificates/verify/DC-2026-INVALID999")
    assert r_invalid.status_code == status.HTTP_200_OK
    invalid_data = r_invalid.json()
    assert invalid_data["is_valid"] is False
    assert invalid_data["certificate_number"] is None
    assert invalid_data["student_name"] is None
    assert invalid_data["course_title"] is None
