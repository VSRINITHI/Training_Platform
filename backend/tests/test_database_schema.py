import pytest
from sqlalchemy import text
from app.core.database import engine


def test_enum_types_exist():
    expected_enums = {
        'user_role': {'ADMIN', 'INSTRUCTOR', 'USER'},
        'difficulty_level': {'BEGINNER', 'INTERMEDIATE', 'ADVANCED'},
        'quiz_type': {'LESSON', 'MODULE', 'FINAL'},
        'question_type': {'MCQ', 'MULTI_SELECT', 'TRUE_FALSE'},
        'ai_draft_status': {'PENDING_REVIEW', 'APPROVED', 'DISCARDED'},
        'enrollment_status': {'ACTIVE', 'COMPLETED', 'DROPPED'},
        'module_progress_status': {'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_RELEARNING'},
    }

    query = text("""
        SELECT t.typname AS enum_name, e.enumlabel AS enum_value
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public';
    """)

    with engine.connect() as conn:
        rows = conn.execute(query).fetchall()

    found_enums: dict[str, set[str]] = {}
    for enum_name, enum_val in rows:
        found_enums.setdefault(enum_name, set()).add(enum_val)

    for name, expected_values in expected_enums.items():
        assert name in found_enums, f"Missing enum type: {name}"
        assert expected_values.issubset(found_enums[name]), f"Enum {name} missing expected values"


def test_all_16_tables_exist():
    expected_tables = {
        'users',
        'domains',
        'sub_domains',
        'user_interests',
        'courses',
        'modules',
        'lessons',
        'quizzes',
        'questions',
        'question_options',
        'ai_quiz_drafts',
        'enrollments',
        'module_progress',
        'lesson_progress',
        'quiz_attempts',
        'certificates',
    }

    query = text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    """)

    with engine.connect() as conn:
        rows = conn.execute(query).fetchall()

    found_tables = {r[0] for r in rows}
    missing = expected_tables - found_tables
    assert not missing, f"Missing tables in public schema: {missing}"


def test_banned_columns_absent():
    query = text("""
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_name IN ('final_exam_id', 'derived_progress_pct', 'is_unlocked', 'content_type');
    """)

    with engine.connect() as conn:
        rows = conn.execute(query).fetchall()

    assert len(rows) == 0, f"Found banned columns in database: {rows}"


def test_lessons_content_model():
    query = text("""
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'lessons'
        AND column_name IN ('content_body', 'video_url', 'document_url');
    """)

    with engine.connect() as conn:
        rows = conn.execute(query).fetchall()

    cols = {r[0]: r[1] for r in rows}
    assert 'content_body' in cols and cols['content_body'] == 'YES'
    assert 'video_url' in cols and cols['video_url'] == 'YES'
    assert 'document_url' in cols and cols['document_url'] == 'YES'


def test_quiz_attempts_foreign_key_delete_rule():
    # Verify fk_quiz_attempts_quiz is ON DELETE RESTRICT (confdeltype = 'r')
    query = text("""
        SELECT conname, confdeltype
        FROM pg_constraint
        WHERE conname = 'fk_quiz_attempts_quiz';
    """)

    with engine.connect() as conn:
        row = conn.execute(query).fetchone()

    assert row is not None, "Constraint fk_quiz_attempts_quiz not found"
    assert row[1] == 'r', f"Expected confdeltype 'r' (RESTRICT), got '{row[1]}'"


def test_quiz_attempts_unique_attempt_constraint():
    query = text("""
        SELECT conname, contype
        FROM pg_constraint
        WHERE conname = 'uq_quiz_attempts_user_quiz_attempt';
    """)

    with engine.connect() as conn:
        row = conn.execute(query).fetchone()

    assert row is not None, "Constraint uq_quiz_attempts_user_quiz_attempt not found"
    assert row[1] == 'u', "Expected contype 'u' (UNIQUE)"


def test_quiz_partial_unique_indexes():
    query = text("""
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'quizzes';
    """)

    with engine.connect() as conn:
        rows = conn.execute(query).fetchall()

    indexes = {r[0] for r in rows}
    assert 'uq_quiz_per_lesson' in indexes
    assert 'uq_quiz_per_module' in indexes
    assert 'uq_quiz_per_course_final' in indexes


def test_performance_indexes_exist():
    query = text("""
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public';
    """)

    with engine.connect() as conn:
        rows = conn.execute(query).fetchall()

    indexes = {r[0] for r in rows}
    expected = [
        'idx_sub_domains_domain',
        'idx_courses_sub_domain_published',
        'idx_user_interests_user',
        'idx_module_progress_enrollment_status',
        'idx_certificates_verification_hash',
    ]
    for idx in expected:
        assert idx in indexes, f"Missing index: {idx}"
