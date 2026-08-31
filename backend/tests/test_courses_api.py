import uuid
from datetime import datetime, timezone
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from app.main import app
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.taxonomy import Domain, SubDomain
from app.models.course import Course, Module, Lesson
from app.models.enums import UserRole, DifficultyLevel
from app.core.database import SessionLocal


# Reusable user fixtures using the factory from conftest
@pytest.fixture
def instructor_1(create_test_user):
    return create_test_user(role=UserRole.INSTRUCTOR, full_name="Instructor One")


@pytest.fixture
def instructor_2(create_test_user):
    return create_test_user(role=UserRole.INSTRUCTOR, full_name="Instructor Two")


@pytest.fixture
def admin_user(create_test_user):
    return create_test_user(role=UserRole.ADMIN, full_name="Admin Curric")


@pytest.fixture
def test_sub_domain():
    db = SessionLocal()
    suffix = str(uuid.uuid4())[:8]
    domain = Domain(name=f"Curric Domain {suffix}", slug=f"curric-dom-{suffix}")
    db.add(domain)
    db.commit()
    db.refresh(domain)

    sub_domain = SubDomain(
        domain_id=domain.id,
        name=f"Curric SubDomain {suffix}",
        slug=f"curric-sub-{suffix}",
    )
    db.add(sub_domain)
    db.commit()
    db.refresh(sub_domain)
    db.close()

    yield sub_domain

    # Teardown
    db = SessionLocal()
    try:
        courses = db.query(Course).filter(Course.sub_domain_id == sub_domain.id).all()
        for c in courses:
            db.delete(c)
        db.query(SubDomain).filter(SubDomain.id == sub_domain.id).delete()
        db.query(Domain).filter(Domain.id == domain.id).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def test_course_curriculum_complete_lifecycle(
    client: TestClient, instructor_1, instructor_2, admin_user, test_sub_domain
):
    suffix = str(uuid.uuid4())[:8]
    course_slug = f"complete-ml-masterclass-{suffix}"

    # 1. Instructor 1 creates a course
    app.dependency_overrides[get_current_user] = lambda: instructor_1
    try:
        course_payload = {
            "title": f"Complete ML Masterclass {suffix}",
            "slug": course_slug,
            "description": "Comprehensive Machine Learning program",
            "sub_domain_id": str(test_sub_domain.id),
            "difficulty_level": "INTERMEDIATE",
        }
        res_create = client.post(
            "/api/v1/courses",
            json=course_payload,
            headers={"Authorization": "Bearer token"},
        )
        assert res_create.status_code == status.HTTP_201_CREATED
        course_data = res_create.json()
        course_id = course_data["id"]
        assert course_data["is_published"] is False

        # 2. Try to publish empty course -> Should FAIL (no modules)
        res_pub_fail = client.post(
            f"/api/v1/courses/{course_id}/publish",
            headers={"Authorization": "Bearer token"},
        )
        assert res_pub_fail.status_code == status.HTTP_400_BAD_REQUEST
        assert "must contain at least one module" in res_pub_fail.json()["detail"]

        # 3. Create Module 1
        res_mod1 = client.post(
            f"/api/v1/courses/{course_id}/modules",
            json={"title": "Module 1: Introduction to ML"},
            headers={"Authorization": "Bearer token"},
        )
        assert res_mod1.status_code == status.HTTP_201_CREATED
        mod1_id = res_mod1.json()["id"]
        assert res_mod1.json()["order_index"] == 1

        # 4. Try to publish course -> Should FAIL (Module 1 has no lessons)
        res_pub_fail2 = client.post(
            f"/api/v1/courses/{course_id}/publish",
            headers={"Authorization": "Bearer token"},
        )
        assert res_pub_fail2.status_code == status.HTTP_400_BAD_REQUEST
        assert "contains no lessons" in res_pub_fail2.json()["detail"]

        # 5. Create Lesson 1 in Module 1 (flexible content: video + doc)
        res_les1 = client.post(
            f"/api/v1/modules/{mod1_id}/lessons",
            json={
                "title": "Lesson 1: Overview & Tools",
                "video_url": "https://example.com/ml-intro.mp4",
                "document_url": "https://example.com/ml-notes.pdf",
                "duration_minutes": 25,
            },
            headers={"Authorization": "Bearer token"},
        )
        assert res_les1.status_code == status.HTTP_201_CREATED
        assert res_les1.json()["order_index"] == 1
        assert res_les1.json()["video_url"] == "https://example.com/ml-intro.mp4"

        # 6. Create Lesson 2 in Module 1 (text content only)
        res_les2 = client.post(
            f"/api/v1/modules/{mod1_id}/lessons",
            json={
                "title": "Lesson 2: Setup Environment",
                "content_body": "# Setup Python & PyTorch\nRun pip install torch",
                "duration_minutes": 15,
            },
            headers={"Authorization": "Bearer token"},
        )
        assert res_les2.status_code == status.HTTP_201_CREATED
        assert res_les2.json()["order_index"] == 2

        # 7. Create Module 2 and Lesson in Module 2
        res_mod2 = client.post(
            f"/api/v1/courses/{course_id}/modules",
            json={"title": "Module 2: Supervised Learning"},
            headers={"Authorization": "Bearer token"},
        )
        assert res_mod2.status_code == status.HTTP_201_CREATED
        mod2_id = res_mod2.json()["id"]
        assert res_mod2.json()["order_index"] == 2

        res_les3 = client.post(
            f"/api/v1/modules/{mod2_id}/lessons",
            json={
                "title": "Lesson 2.1: Linear Regression",
                "content_body": "Cost function and gradient descent",
            },
            headers={"Authorization": "Bearer token"},
        )
        assert res_les3.status_code == status.HTTP_201_CREATED

        # 8. Now Publish Course -> Should SUCCEED
        res_pub = client.post(
            f"/api/v1/courses/{course_id}/publish",
            headers={"Authorization": "Bearer token"},
        )
        assert res_pub.status_code == status.HTTP_200_OK
        assert res_pub.json()["is_published"] is True

        # 9. Get full course curriculum detail (Public view)
        res_detail = client.get(f"/api/v1/courses/{course_slug}")
        assert res_detail.status_code == status.HTTP_200_OK
        curric = res_detail.json()
        assert len(curric["modules"]) == 2
        assert len(curric["modules"][0]["lessons"]) == 2
        assert len(curric["modules"][1]["lessons"]) == 1

        # 10. Reorder modules
        res_reorder_mod = client.post(
            f"/api/v1/courses/{course_id}/modules/reorder",
            json={"items": [{"id": mod1_id, "order_index": 2}, {"id": mod2_id, "order_index": 1}]},
            headers={"Authorization": "Bearer token"},
        )
        assert res_reorder_mod.status_code == status.HTTP_200_OK

        # 11. Other instructor (Instructor 2) attempts to edit -> Should get 403 FORBIDDEN
        app.dependency_overrides[get_current_user] = lambda: instructor_2
        res_unauthorized_edit = client.patch(
            f"/api/v1/courses/{course_id}",
            json={"title": "Hacked Course Title"},
            headers={"Authorization": "Bearer token"},
        )
        assert res_unauthorized_edit.status_code == status.HTTP_403_FORBIDDEN

        # 12. Admin can edit and unpublish any course
        app.dependency_overrides[get_current_user] = lambda: admin_user
        res_admin_unpub = client.post(
            f"/api/v1/courses/{course_id}/unpublish",
            headers={"Authorization": "Bearer token"},
        )
        assert res_admin_unpub.status_code == status.HTTP_200_OK
        assert res_admin_unpub.json()["is_published"] is False

    finally:
        app.dependency_overrides.pop(get_current_user, None)
