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
from app.models.enrollment import Enrollment, ModuleProgress, LessonProgress
from app.models.enums import UserRole, EnrollmentStatus, ModuleProgressStatus
from app.core.database import SessionLocal


@pytest.fixture
def instructor_user(create_test_user):
    return create_test_user(role=UserRole.INSTRUCTOR, full_name="Progress Instructor")


@pytest.fixture
def learner_user(create_test_user):
    return create_test_user(role=UserRole.USER, full_name="Active Learner")


@pytest.fixture
def other_learner(create_test_user):
    return create_test_user(role=UserRole.USER, full_name="Other Learner")


@pytest.fixture
def multi_module_course(instructor_user):
    db = SessionLocal()
    suffix = str(uuid.uuid4())[:8]
    domain = Domain(name=f"Prog Domain {suffix}", slug=f"prog-dom-{suffix}")
    db.add(domain)
    db.commit()
    db.refresh(domain)

    sub_domain = SubDomain(
        domain_id=domain.id,
        name=f"Prog SubDomain {suffix}",
        slug=f"prog-sub-{suffix}",
    )
    db.add(sub_domain)
    db.commit()
    db.refresh(sub_domain)

    course = Course(
        instructor_id=instructor_user.id,
        sub_domain_id=sub_domain.id,
        title=f"Full Stack Data Engineering {suffix}",
        slug=f"fs-data-eng-{suffix}",
        description="Course with two required modules to test dynamic progression",
        is_published=True,
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    mod1 = Module(
        course_id=course.id,
        title="Module 1: Data Modeling",
        order_index=1,
        is_required=True,
    )
    db.add(mod1)
    db.commit()
    db.refresh(mod1)

    les1_1 = Lesson(
        module_id=mod1.id,
        title="Lesson 1.1: Relational Schemas",
        order_index=1,
        content_body="Relational modeling",
    )
    db.add(les1_1)

    mod2 = Module(
        course_id=course.id,
        title="Module 2: Distributed Pipelines",
        order_index=2,
        is_required=True,
    )
    db.add(mod2)
    db.commit()
    db.refresh(mod2)

    les2_1 = Lesson(
        module_id=mod2.id,
        title="Lesson 2.1: Apache Spark",
        order_index=1,
        content_body="Spark processing",
    )
    db.add(les2_1)
    db.commit()
    db.refresh(les1_1)
    db.refresh(les2_1)

    data = {
        "domain_id": domain.id,
        "sub_domain_id": sub_domain.id,
        "course_id": course.id,
        "mod1_id": mod1.id,
        "mod2_id": mod2.id,
        "les1_1_id": les1_1.id,
        "les2_1_id": les2_1.id,
    }
    db.close()

    yield data

    # Teardown
    db = SessionLocal()
    try:
        from sqlalchemy import text
        db.execute(text("DELETE FROM enrollments WHERE course_id = :id"), {"id": data["course_id"]})
        db.execute(text("DELETE FROM courses WHERE id = :id"), {"id": data["course_id"]})
        db.execute(text("DELETE FROM sub_domains WHERE id = :id"), {"id": data["sub_domain_id"]})
        db.execute(text("DELETE FROM domains WHERE id = :id"), {"id": data["domain_id"]})
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def test_enrollment_and_dynamic_progress_lifecycle(
    client: TestClient, learner_user, other_learner, multi_module_course
):
    course_id = str(multi_module_course["course_id"])
    mod1_id = str(multi_module_course["mod1_id"])
    mod2_id = str(multi_module_course["mod2_id"])
    les1_1_id = str(multi_module_course["les1_1_id"])
    les2_1_id = str(multi_module_course["les2_1_id"])

    # 1. Learner enrolls in the course
    app.dependency_overrides[get_current_user] = lambda: learner_user
    try:
        res_enroll = client.post(
            "/api/v1/enrollments",
            json={"course_id": course_id},
            headers={"Authorization": "Bearer token"},
        )
        assert res_enroll.status_code == status.HTTP_201_CREATED
        enr_data = res_enroll.json()
        assert enr_data["status"] == "ACTIVE"
        assert enr_data["progress_pct"] == "0.00"

        # 2. Duplicate enrollment rejected
        res_dup = client.post(
            "/api/v1/enrollments",
            json={"course_id": course_id},
            headers={"Authorization": "Bearer token"},
        )
        assert res_dup.status_code == status.HTTP_400_BAD_REQUEST

        # 3. Check Initial Course Progress Tree
        res_prog1 = client.get(
            f"/api/v1/courses/{course_id}/progress",
            headers={"Authorization": "Bearer token"},
        )
        assert res_prog1.status_code == status.HTTP_200_OK
        p_data1 = res_prog1.json()
        assert p_data1["progress_pct"] == "0.00"
        assert p_data1["total_required_modules"] == 2
        assert p_data1["completed_required_modules"] == 0
        assert p_data1["is_final_exam_unlocked"] is False

        # Verify Module 1 is unlocked, Module 2 is locked
        m1_info = next(m for m in p_data1["modules"] if m["module_id"] == mod1_id)
        m2_info = next(m for m in p_data1["modules"] if m["module_id"] == mod2_id)
        assert m1_info["is_unlocked"] is True
        assert m2_info["is_unlocked"] is False

        # 4. Attempting to complete lesson in locked Module 2 -> Should FAIL with 400
        res_locked_les = client.post(
            f"/api/v1/lessons/{les2_1_id}/progress",
            json={"is_completed": True},
            headers={"Authorization": "Bearer token"},
        )
        assert res_locked_les.status_code == status.HTTP_400_BAD_REQUEST
        assert "Previous required modules must be completed" in res_locked_les.json()["detail"]

        # 5. Complete Lesson 1.1 in Module 1
        res_comp_les1 = client.post(
            f"/api/v1/lessons/{les1_1_id}/progress",
            json={"is_completed": True},
            headers={"Authorization": "Bearer token"},
        )
        assert res_comp_les1.status_code == status.HTTP_200_OK
        assert res_comp_les1.json()["is_completed"] is True

        # 6. Check Progress: Module 1 is COMPLETED -> Module 2 is UNLOCKED -> Progress is 50.00%
        res_prog2 = client.get(
            f"/api/v1/courses/{course_id}/progress",
            headers={"Authorization": "Bearer token"},
        )
        assert res_prog2.status_code == status.HTTP_200_OK
        p_data2 = res_prog2.json()
        assert p_data2["progress_pct"] == "50.00"
        assert p_data2["completed_required_modules"] == 1
        assert p_data2["is_final_exam_unlocked"] is False

        m1_info_after = next(m for m in p_data2["modules"] if m["module_id"] == mod1_id)
        m2_info_after = next(m for m in p_data2["modules"] if m["module_id"] == mod2_id)
        assert m1_info_after["status"] == "COMPLETED"
        assert m2_info_after["is_unlocked"] is True

        # 7. Now complete Lesson 2.1 in Module 2 -> Progress is 100.00% -> Final Exam is UNLOCKED
        res_comp_les2 = client.post(
            f"/api/v1/lessons/{les2_1_id}/progress",
            json={"is_completed": True},
            headers={"Authorization": "Bearer token"},
        )
        assert res_comp_les2.status_code == status.HTTP_200_OK

        res_prog3 = client.get(
            f"/api/v1/courses/{course_id}/progress",
            headers={"Authorization": "Bearer token"},
        )
        assert res_prog3.status_code == status.HTTP_200_OK
        p_data3 = res_prog3.json()
        assert p_data3["progress_pct"] == "100.00"
        assert p_data3["completed_required_modules"] == 2
        assert p_data3["is_final_exam_unlocked"] is True

        # 8. Test Relearning Reset:
        # Simulate module 1 entering NEEDS_RELEARNING state
        db = SessionLocal()
        try:
            db.query(ModuleProgress).filter(
                ModuleProgress.module_id == uuid.UUID(mod1_id)
            ).update({"status": ModuleProgressStatus.NEEDS_RELEARNING})
            db.commit()
        finally:
            db.close()

        # Reset relearning
        res_reset = client.post(
            f"/api/v1/modules/{mod1_id}/relearning/reset",
            headers={"Authorization": "Bearer token"},
        )
        assert res_reset.status_code == status.HTTP_200_OK

        # Verify Lesson 1.1 was reset to is_completed=False
        res_prog4 = client.get(
            f"/api/v1/courses/{course_id}/progress",
            headers={"Authorization": "Bearer token"},
        )
        p_data4 = res_prog4.json()
        m1_info_rel = next(m for m in p_data4["modules"] if m["module_id"] == mod1_id)
        assert m1_info_rel["status"] == "IN_PROGRESS"
        assert m1_info_rel["lesson_progress_records"][0]["is_completed"] is False

    finally:
        app.dependency_overrides.pop(get_current_user, None)
