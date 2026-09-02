"""
Integration tests for Module Quiz 2-attempt lifecycle, relearning reset, and course completion.
"""
import uuid
from decimal import Decimal
import pytest
from app.core.database import SessionLocal
from app.models.taxonomy import Domain, SubDomain
from app.models.course import Course, Module, Lesson
from app.models.quiz import Quiz, Question, QuestionOption
from app.models.assessment import Certificate, QuizAttempt
from app.models.enrollment import Enrollment, ModuleProgress, LessonProgress
from app.models.enums import UserRole, QuizType, QuestionType, EnrollmentStatus, ModuleProgressStatus
from app.core.security import create_access_token


@pytest.fixture
def setup_lifecycle_data(create_test_user):
    instructor = create_test_user(role=UserRole.INSTRUCTOR, full_name="Instructor Alex")
    learner = create_test_user(role=UserRole.USER, full_name="Learner Jordan")

    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    try:
        # Domain & Subdomain
        domain = Domain(name=f"IT Domain {suffix}", slug=f"it-domain-{suffix}")
        db.add(domain)
        db.commit()
        db.refresh(domain)

        sub_domain = SubDomain(domain_id=domain.id, name=f"Python Tech {suffix}", slug=f"python-tech-{suffix}")
        db.add(sub_domain)
        db.commit()
        db.refresh(sub_domain)

        # Course
        course = Course(
            instructor_id=instructor.id,
            sub_domain_id=sub_domain.id,
            title=f"Python Mastery Course {suffix}",
            slug=f"py-mastery-{suffix}",
            description="Complete Python Guide",
            is_published=True,
        )
        db.add(course)
        db.commit()
        db.refresh(course)

        # Module 1
        m1 = Module(course_id=course.id, title="Module 1: Basics", order_index=1, is_required=True)
        db.add(m1)
        db.commit()
        db.refresh(m1)

        l1_1 = Lesson(module_id=m1.id, title="Lesson 1.1: Syntax", order_index=1)
        l1_2 = Lesson(module_id=m1.id, title="Lesson 1.2: Variables", order_index=2)
        db.add_all([l1_1, l1_2])
        db.commit()
        db.refresh(l1_1)
        db.refresh(l1_2)

        # Module 1 Quiz (Max 2 attempts, passing score 70%)
        m1_quiz = Quiz(
            title="Module 1 Assessment",
            quiz_type=QuizType.MODULE,
            module_id=m1.id,
            passing_score=Decimal("70.00"),
            max_attempts=2,
            is_active=True,
        )
        db.add(m1_quiz)
        db.commit()
        db.refresh(m1_quiz)

        # Questions for Module 1 Quiz (Total 10 points)
        q1 = Question(quiz_id=m1_quiz.id, question_text="Is Python dynamic?", question_type=QuestionType.TRUE_FALSE, points=5, order_index=1)
        db.add(q1)
        db.commit()
        db.refresh(q1)

        opt1_t = QuestionOption(question_id=q1.id, option_text="True", is_correct=True, order_index=1)
        opt1_f = QuestionOption(question_id=q1.id, option_text="False", is_correct=False, order_index=2)
        db.add_all([opt1_t, opt1_f])
        db.commit()
        db.refresh(opt1_t)
        db.refresh(opt1_f)

        q2 = Question(quiz_id=m1_quiz.id, question_text="Select variable syntax", question_type=QuestionType.MCQ, points=5, order_index=2)
        db.add(q2)
        db.commit()
        db.refresh(q2)

        opt2_a = QuestionOption(question_id=q2.id, option_text="x = 5", is_correct=True, order_index=1)
        opt2_b = QuestionOption(question_id=q2.id, option_text="int x := 5", is_correct=False, order_index=2)
        db.add_all([opt2_a, opt2_b])
        db.commit()
        db.refresh(opt2_a)
        db.refresh(opt2_b)

        # Module 2
        m2 = Module(course_id=course.id, title="Module 2: Advanced", order_index=2, is_required=True)
        db.add(m2)
        db.commit()
        db.refresh(m2)

        l2_1 = Lesson(module_id=m2.id, title="Lesson 2.1: OOP", order_index=1)
        db.add(l2_1)
        db.commit()
        db.refresh(l2_1)

        # Final Exam Quiz for Course
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

        fq1 = Question(quiz_id=final_quiz.id, question_text="Final question?", question_type=QuestionType.TRUE_FALSE, points=10, order_index=1)
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
            "course_id": course.id,
            "domain_id": domain.id,
            "sub_domain_id": sub_domain.id,
            "m1_id": m1.id,
            "l1_1_id": l1_1.id,
            "l1_2_id": l1_2.id,
            "m1_quiz_id": m1_quiz.id,
            "q1_id": q1.id,
            "opt1_t_id": opt1_t.id,
            "opt1_f_id": opt1_f.id,
            "q2_id": q2.id,
            "opt2_a_id": opt2_a.id,
            "opt2_b_id": opt2_b.id,
            "m2_id": m2.id,
            "final_quiz_id": final_quiz.id,
            "fq1_id": fq1.id,
            "fopt1_id": fopt1.id,
        }
    finally:
        db.close()

    yield data


def test_module_quiz_prerequisite_lessons_enforced(client, setup_lifecycle_data):
    d = setup_lifecycle_data
    token = create_access_token(str(d["learner"].id), d["learner"].email)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Enroll learner
    r_enroll = client.post("/api/v1/enrollments", json={"course_id": str(d["course_id"])}, headers=headers)
    assert r_enroll.status_code == 201

    # 2. Attempt module quiz BEFORE completing lessons -> Expect 400 Bad Request
    sub_payload = {
        "answers": [
            {"question_id": str(d["q1_id"]), "selected_option_ids": [str(d["opt1_t_id"])]},
            {"question_id": str(d["q2_id"]), "selected_option_ids": [str(d["opt2_a_id"])]},
        ]
    }
    r_sub = client.post(f"/api/v1/quizzes/{d['m1_quiz_id']}/submit", json=sub_payload, headers=headers)
    assert r_sub.status_code == 400
    assert "lessons in module" in r_sub.json()["detail"].lower()


def test_module_quiz_2_failed_attempts_triggers_relearning_and_reset(client, setup_lifecycle_data):
    d = setup_lifecycle_data
    token = create_access_token(str(d["learner"].id), d["learner"].email)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Enroll
    client.post("/api/v1/enrollments", json={"course_id": str(d["course_id"])}, headers=headers)

    # 2. Complete Lesson 1.1 and 1.2
    client.post(f"/api/v1/lessons/{d['l1_1_id']}/progress", json={"is_completed": True}, headers=headers)
    client.post(f"/api/v1/lessons/{d['l1_2_id']}/progress", json={"is_completed": True}, headers=headers)

    # 3. First Failed Attempt (0 points)
    fail_answers = {
        "answers": [
            {"question_id": str(d["q1_id"]), "selected_option_ids": [str(d["opt1_f_id"])]},
            {"question_id": str(d["q2_id"]), "selected_option_ids": [str(d["opt2_b_id"])]},
        ]
    }
    r1 = client.post(f"/api/v1/quizzes/{d['m1_quiz_id']}/submit", json=fail_answers, headers=headers)
    assert r1.status_code == 200
    res1 = r1.json()
    assert res1["is_passed"] is False
    assert res1["attempt_number"] == 1
    assert res1["relearning_triggered"] is False

    # Check progress: 1 attempt used, module remains IN_PROGRESS
    r_prog1 = client.get(f"/api/v1/courses/{d['course_id']}/progress", headers=headers)
    m1_prog = next(m for m in r_prog1.json()["modules"] if m["module_id"] == str(d["m1_id"]))
    assert m1_prog["status"] == "IN_PROGRESS"
    assert m1_prog["attempts_used"] == 1
    assert m1_prog["quiz_attempts_remaining"] == 1

    # 4. Second Failed Attempt -> Exhausts 2 attempts!
    r2 = client.post(f"/api/v1/quizzes/{d['m1_quiz_id']}/submit", json=fail_answers, headers=headers)
    assert r2.status_code == 200
    res2 = r2.json()
    assert res2["is_passed"] is False
    assert res2["attempt_number"] == 2
    assert res2["relearning_triggered"] is True

    # Check progress: Status is NEEDS_RELEARNING, lessons have been reset to 0% completed!
    r_prog2 = client.get(f"/api/v1/courses/{d['course_id']}/progress", headers=headers)
    m1_prog2 = next(m for m in r_prog2.json()["modules"] if m["module_id"] == str(d["m1_id"]))
    assert m1_prog2["status"] == "NEEDS_RELEARNING"
    assert m1_prog2["completed_lessons_count"] == 0

    # 5. 3rd Attempt in same cycle is rejected with 400
    r3 = client.post(f"/api/v1/quizzes/{d['m1_quiz_id']}/submit", json=fail_answers, headers=headers)
    assert r3.status_code == 400
    assert "relearning" in r3.json()["detail"].lower()

    # 6. Reset relearning via endpoint
    r_reset = client.post(f"/api/v1/modules/{d['m1_id']}/relearning/reset", headers=headers)
    assert r_reset.status_code == 200

    # 7. Complete lessons again
    client.post(f"/api/v1/lessons/{d['l1_1_id']}/progress", json={"is_completed": True}, headers=headers)
    client.post(f"/api/v1/lessons/{d['l1_2_id']}/progress", json={"is_completed": True}, headers=headers)

    # 8. New attempt in Cycle 2 with 100% correct answers
    pass_answers = {
        "answers": [
            {"question_id": str(d["q1_id"]), "selected_option_ids": [str(d["opt1_t_id"])]},
            {"question_id": str(d["q2_id"]), "selected_option_ids": [str(d["opt2_a_id"])]},
        ]
    }
    r4 = client.post(f"/api/v1/quizzes/{d['m1_quiz_id']}/submit", json=pass_answers, headers=headers)
    assert r4.status_code == 200
    res4 = r4.json()
    assert res4["is_passed"] is True
    assert res4["attempt_cycle"] == 2

    # Check that Module 1 is now COMPLETED
    r_prog4 = client.get(f"/api/v1/courses/{d['course_id']}/progress", headers=headers)
    m1_prog4 = next(m for m in r_prog4.json()["modules"] if m["module_id"] == str(d["m1_id"]))
    assert m1_prog4["status"] == "COMPLETED"
    assert m1_prog4["is_quiz_passed"] is True

    # Check Module 2 is now UNLOCKED
    m2_prog = next(m for m in r_prog4.json()["modules"] if m["module_id"] == str(d["m2_id"]))
    assert m2_prog["is_unlocked"] is True
