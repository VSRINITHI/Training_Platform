"""
Tests for professional course metadata (Prerequisites, Learning Outcomes, Certificate Availability).
"""
import uuid
from decimal import Decimal
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.models.taxonomy import Domain, SubDomain
from app.models.course import Course, Module, Lesson
from app.models.quiz import Quiz, Question, QuestionOption
from app.models.enums import UserRole, DifficultyLevel, QuizType, QuestionType
from app.core.database import SessionLocal
from app.core.security import create_access_token


@pytest.fixture
def course_metadata_setup(create_test_user):
    instructor = create_test_user(role=UserRole.INSTRUCTOR, full_name="Metadata Instructor")
    learner = create_test_user(role=UserRole.USER, full_name="Metadata Learner")

    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    try:
        domain = Domain(name=f"Meta Domain {suffix}", slug=f"meta-dom-{suffix}")
        db.add(domain)
        db.commit()
        db.refresh(domain)

        sub_domain = SubDomain(domain_id=domain.id, name=f"Meta Sub {suffix}", slug=f"meta-sub-{suffix}")
        db.add(sub_domain)
        db.commit()
        db.refresh(sub_domain)

        data = {
            "instructor": instructor,
            "learner": learner,
            "domain_id": domain.id,
            "sub_domain_id": sub_domain.id,
        }
    finally:
        db.close()

    yield data

    # Cleanup
    db_clean = SessionLocal()
    try:
        from sqlalchemy import text
        sid = data["sub_domain_id"]
        did = data["domain_id"]
        # Delete courses created under this subdomain
        courses = db_clean.query(Course).filter(Course.sub_domain_id == sid).all()
        for c in courses:
            db_clean.execute(text("DELETE FROM certificates WHERE course_id = :cid"), {"cid": c.id})
            db_clean.execute(text("DELETE FROM quiz_attempts WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = :cid OR module_id IN (SELECT id FROM modules WHERE course_id = :cid))"), {"cid": c.id})
            db_clean.execute(text("DELETE FROM lesson_progress WHERE module_progress_id IN (SELECT id FROM module_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE course_id = :cid))"), {"cid": c.id})
            db_clean.execute(text("DELETE FROM module_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE course_id = :cid)"), {"cid": c.id})
            db_clean.execute(text("DELETE FROM enrollments WHERE course_id = :cid"), {"cid": c.id})
            db_clean.execute(text("DELETE FROM question_options WHERE question_id IN (SELECT id FROM questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = :cid OR module_id IN (SELECT id FROM modules WHERE course_id = :cid)))"), {"cid": c.id})
            db_clean.execute(text("DELETE FROM questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = :cid OR module_id IN (SELECT id FROM modules WHERE course_id = :cid))"), {"cid": c.id})
            db_clean.execute(text("DELETE FROM quizzes WHERE course_id = :cid OR module_id IN (SELECT id FROM modules WHERE course_id = :cid)"), {"cid": c.id})
            db_clean.execute(text("DELETE FROM lessons WHERE module_id IN (SELECT id FROM modules WHERE course_id = :cid)"), {"cid": c.id})
            db_clean.execute(text("DELETE FROM modules WHERE course_id = :cid"), {"cid": c.id})
            db_clean.execute(text("DELETE FROM courses WHERE id = :cid"), {"cid": c.id})
        db_clean.execute(text("DELETE FROM sub_domains WHERE id = :sid"), {"sid": sid})
        db_clean.execute(text("DELETE FROM domains WHERE id = :did"), {"did": did})
        db_clean.commit()
    except Exception:
        db_clean.rollback()
    finally:
        db_clean.close()


def test_course_creation_with_metadata(client: TestClient, course_metadata_setup):
    d = course_metadata_setup
    inst_token = create_access_token(str(d["instructor"].id), d["instructor"].email)
    headers = {"Authorization": f"Bearer {inst_token}"}

    payload = {
        "title": "Data Engineering with PySpark",
        "slug": f"pyspark-de-{uuid.uuid4().hex[:6]}",
        "description": "Comprehensive Spark course for large scale data pipelines.",
        "sub_domain_id": str(d["sub_domain_id"]),
        "difficulty_level": "ADVANCED",
        "prerequisites": [
            "Basic Python proficiency",
            "Understanding of SQL databases",
            "Command line familiarity",
        ],
        "learning_outcomes": [
            "Architect distributed data processing pipelines with Apache Spark",
            "Transform large-scale datasets using PySpark DataFrame API",
            "Optimize Spark jobs for production workloads",
        ],
        "has_certificate": True,
    }

    res = client.post("/api/v1/courses", json=payload, headers=headers)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["title"] == payload["title"]
    assert data["prerequisites"] == payload["prerequisites"]
    assert data["learning_outcomes"] == payload["learning_outcomes"]
    assert data["has_certificate"] is True


def test_course_creation_with_multiline_string_sanitization(client: TestClient, course_metadata_setup):
    d = course_metadata_setup
    inst_token = create_access_token(str(d["instructor"].id), d["instructor"].email)
    headers = {"Authorization": f"Bearer {inst_token}"}

    payload = {
        "title": "Machine Learning Fundamentals",
        "slug": f"ml-fund-{uuid.uuid4().hex[:6]}",
        "description": "Foundational course on classical ML algorithms.",
        "sub_domain_id": str(d["sub_domain_id"]),
        "difficulty_level": "BEGINNER",
        "prerequisites": "  High school math \n\n  Basic Python  \n  ",
        "learning_outcomes": " Understand linear regression \n\n Evaluate models with cross-validation \n",
        "has_certificate": False,
    }

    res = client.post("/api/v1/courses", json=payload, headers=headers)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["prerequisites"] == ["High school math", "Basic Python"]
    assert data["learning_outcomes"] == ["Understand linear regression", "Evaluate models with cross-validation"]
    assert data["has_certificate"] is False


def test_course_update_metadata(client: TestClient, course_metadata_setup):
    d = course_metadata_setup
    inst_token = create_access_token(str(d["instructor"].id), d["instructor"].email)
    headers = {"Authorization": f"Bearer {inst_token}"}

    # 1. Create with defaults
    create_payload = {
        "title": "Initial Course Title",
        "slug": f"init-course-{uuid.uuid4().hex[:6]}",
        "description": "Initial description of the course.",
        "sub_domain_id": str(d["sub_domain_id"]),
    }
    c_res = client.post("/api/v1/courses", json=create_payload, headers=headers)
    assert c_res.status_code == status.HTTP_201_CREATED
    c_id = c_res.json()["id"]
    assert c_res.json()["has_certificate"] is True
    assert c_res.json()["prerequisites"] is None

    # 2. Update with metadata
    update_payload = {
        "prerequisites": ["Python 3.10+ installed"],
        "learning_outcomes": ["Build REST APIs with FastAPI", "Deploy to cloud"],
        "has_certificate": False,
    }
    u_res = client.patch(f"/api/v1/courses/{c_id}", json=update_payload, headers=headers)
    assert u_res.status_code == status.HTTP_200_OK
    data = u_res.json()
    assert data["prerequisites"] == ["Python 3.10+ installed"]
    assert data["learning_outcomes"] == ["Build REST APIs with FastAPI", "Deploy to cloud"]
    assert data["has_certificate"] is False


def test_no_certificate_course_blocks_certificate_claim(client: TestClient, course_metadata_setup):
    d = course_metadata_setup
    inst_token = create_access_token(str(d["instructor"].id), d["instructor"].email)
    learner_token = create_access_token(str(d["learner"].id), d["learner"].email)

    # 1. Create course with has_certificate = False and publish it
    c_res = client.post(
        "/api/v1/courses",
        json={
            "title": "Audit Only Course",
            "slug": f"audit-course-{uuid.uuid4().hex[:6]}",
            "description": "Course without certification.",
            "sub_domain_id": str(d["sub_domain_id"]),
            "has_certificate": False,
        },
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert c_res.status_code == status.HTTP_201_CREATED
    course_id = c_res.json()["id"]

    # Publish course
    p_res = client.patch(
        f"/api/v1/courses/{course_id}",
        json={"is_published": True},
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert p_res.status_code == status.HTTP_200_OK

    # 2. Enroll learner
    e_res = client.post(
        "/api/v1/enrollments",
        json={"course_id": course_id},
        headers={"Authorization": f"Bearer {learner_token}"},
    )
    assert e_res.status_code == status.HTTP_201_CREATED

    # 3. Attempt claiming certificate -> Must be rejected with 400
    cert_res = client.post(
        f"/api/v1/courses/{course_id}/certificate",
        headers={"Authorization": f"Bearer {learner_token}"},
    )
    assert cert_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "does not offer a certificate" in cert_res.json()["detail"].lower()
