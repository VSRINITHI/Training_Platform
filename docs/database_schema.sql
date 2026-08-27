-- =============================================================================
-- DataCaliper Training Platform — Supabase PostgreSQL Schema
-- Data Model Spec Version: 5.0 (Final Approved)
-- Generated: 2026-08-27
--
-- IMPORTANT NOTES:
--   - This schema implements data_model_spec.md v5.0 exactly.
--   - Do NOT execute this script automatically. Review before applying.
--   - No triggers are created. All business logic lives in FastAPI.
--   - No seed/sample data is included.
--   - No Supabase Auth users are created here.
--   - Cross-entity ownership validation (module->course, lesson->module)
--     is enforced by the FastAPI service layer, not the database.
--   - Run in Supabase SQL editor or via psql against your Supabase project.
-- =============================================================================


-- =============================================================================
-- SECTION 1: EXTENSIONS
-- =============================================================================

-- pgcrypto provides gen_random_uuid() used as the default UUID generator.
-- In Supabase (PostgreSQL 14+), gen_random_uuid() is available natively.
-- This line is safe to run even if already enabled.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- SECTION 2: ENUM TYPES
-- =============================================================================
-- Uses DO $$ blocks to safely skip creation if the type already exists.
-- Idempotent: safe to rerun without dropping existing types.

-- 2.1 User roles
-- Controls access to admin, instructor, and learner areas.
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'INSTRUCTOR', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2.2 Course difficulty levels
DO $$ BEGIN
    CREATE TYPE difficulty_level AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2.3 Quiz types
-- LESSON -> attached to a single lesson (optional, instructor-defined)
-- MODULE -> end-of-module assessment (passing required to complete module)
-- FINAL  -> final course exam (unlocks when course_progress_pct >= 80%)
DO $$ BEGIN
    CREATE TYPE quiz_type AS ENUM ('LESSON', 'MODULE', 'FINAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2.4 Question types
DO $$ BEGIN
    CREATE TYPE question_type AS ENUM ('MCQ', 'MULTI_SELECT', 'TRUE_FALSE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2.5 AI quiz draft statuses
-- PENDING_REVIEW -> newly generated, awaiting instructor action
-- APPROVED       -> instructor reviewed and promoted to production quiz tables
-- DISCARDED      -> instructor rejected; no further action
DO $$ BEGIN
    CREATE TYPE ai_draft_status AS ENUM ('PENDING_REVIEW', 'APPROVED', 'DISCARDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2.6 Enrollment statuses
DO $$ BEGIN
    CREATE TYPE enrollment_status AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2.7 Module progress statuses
-- NOT_STARTED      -> enrollment created but user has not opened this module
-- IN_PROGRESS      -> user has opened at least one lesson
-- COMPLETED        -> all lessons done and module quiz passed
-- NEEDS_RELEARNING -> user exhausted max quiz attempts without passing;
--                     lesson_progress flags are reset; new cycle required
DO $$ BEGIN
    CREATE TYPE module_progress_status AS ENUM (
        'NOT_STARTED',
        'IN_PROGRESS',
        'COMPLETED',
        'NEEDS_RELEARNING'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- SECTION 3: TABLES
-- Created in dependency order (referenced tables first).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.01  users
-- Mirrors Supabase auth.users. Role is managed here, not in Auth metadata.
-- id must match auth.users.id exactly (set during first login profile sync).
-- FastAPI syncs this table on each user's first authenticated request.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id          UUID          NOT NULL,
    email       VARCHAR(255)  NOT NULL,
    full_name   VARCHAR(255)  NOT NULL,
    role        user_role     NOT NULL DEFAULT 'USER',
    avatar_url  TEXT          NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_users       PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),

    -- Cascade delete: removing the auth identity also removes the platform profile.
    CONSTRAINT fk_users_auth
        FOREIGN KEY (id) REFERENCES auth.users (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE  public.users            IS 'Platform user profiles. id mirrors auth.users(id). Role managed here.';
COMMENT ON COLUMN public.users.role       IS 'Application role: ADMIN | INSTRUCTOR | USER';
COMMENT ON COLUMN public.users.updated_at IS 'Updated by FastAPI on each profile change (not via trigger).';


-- -----------------------------------------------------------------------------
-- 3.02  domains
-- Top-level subject areas. Seeded and managed by admins only.
-- Examples: Finance, Software & IT, Electronics, Business, Healthcare
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.domains (
    id          UUID          NOT NULL DEFAULT gen_random_uuid(),
    name        VARCHAR(100)  NOT NULL,
    slug        VARCHAR(100)  NOT NULL,
    description TEXT          NULL,
    icon_url    TEXT          NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_domains      PRIMARY KEY (id),
    CONSTRAINT uq_domains_name UNIQUE (name),
    CONSTRAINT uq_domains_slug UNIQUE (slug)
);

COMMENT ON TABLE public.domains IS 'Top-level subject areas (Finance, Software & IT, Electronics, ...).';


-- -----------------------------------------------------------------------------
-- 3.03  sub_domains
-- Specific topic areas within a domain. Each belongs to exactly one domain.
-- Examples (Finance): Stock Market, Mutual Funds, Taxation
-- Examples (Software & IT): Machine Learning, Data Science, Cyber Security, IoT
-- The parent domain of a course is derived as:
--   courses.sub_domain_id -> sub_domains.domain_id -> domains
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sub_domains (
    id          UUID          NOT NULL DEFAULT gen_random_uuid(),
    domain_id   UUID          NOT NULL,
    name        VARCHAR(150)  NOT NULL,
    slug        VARCHAR(150)  NOT NULL,
    description TEXT          NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_sub_domains      PRIMARY KEY (id),
    CONSTRAINT uq_sub_domains_slug UNIQUE (slug),

    -- RESTRICT: cannot delete a domain while sub-domains still reference it.
    CONSTRAINT fk_sub_domains_domain
        FOREIGN KEY (domain_id) REFERENCES public.domains (id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE  public.sub_domains           IS 'Topic areas within a domain. Course parent domain derived via sub_domains.domain_id.';
COMMENT ON COLUMN public.sub_domains.domain_id IS 'Parent domain. Use JOIN to derive domain label for a course or user interest.';


-- -----------------------------------------------------------------------------
-- 3.04  user_interests
-- Normalized user <-> sub-domain interest mapping.
-- Parent domain is NEVER stored here; always derived via sub_domains.domain_id.
-- Personalization path: user -> user_interests -> sub_domains -> courses
-- User onboarding: UI shows domains + sub-domains; persists selected sub-domains.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_interests (
    id            UUID        NOT NULL DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL,
    sub_domain_id UUID        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_user_interests PRIMARY KEY (id),

    -- A user can select each sub-domain interest only once.
    CONSTRAINT uq_user_interests_user_subdomain UNIQUE (user_id, sub_domain_id),

    CONSTRAINT fk_user_interests_user
        FOREIGN KEY (user_id) REFERENCES public.users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_interests_sub_domain
        FOREIGN KEY (sub_domain_id) REFERENCES public.sub_domains (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.user_interests IS 'User interest selections at the sub-domain level. Parent domain derived via sub_domains.domain_id.';


-- -----------------------------------------------------------------------------
-- 3.05  courses
-- Training programs. Each course belongs to exactly one sub-domain.
-- IMPORTANT: No final_exam_id column here.
-- The final exam is always queried as:
--   SELECT * FROM quizzes WHERE quiz_type = 'FINAL' AND course_id = <this id>
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
    id               UUID             NOT NULL DEFAULT gen_random_uuid(),
    instructor_id    UUID             NOT NULL,
    sub_domain_id    UUID             NOT NULL,
    title            VARCHAR(255)     NOT NULL,
    slug             VARCHAR(255)     NOT NULL,
    description      TEXT             NOT NULL,
    thumbnail_url    TEXT             NULL,
    difficulty_level difficulty_level NULL,
    is_published     BOOLEAN          NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_courses      PRIMARY KEY (id),
    CONSTRAINT uq_courses_slug UNIQUE (slug),

    -- RESTRICT: cannot delete a user account that owns courses.
    CONSTRAINT fk_courses_instructor
        FOREIGN KEY (instructor_id) REFERENCES public.users (id)
        ON DELETE RESTRICT,

    -- RESTRICT: cannot delete a sub-domain while courses exist under it.
    CONSTRAINT fk_courses_sub_domain
        FOREIGN KEY (sub_domain_id) REFERENCES public.sub_domains (id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE  public.courses              IS 'Training programs. Belongs to exactly one sub-domain. No final_exam_id; use quizzes.quiz_type=FINAL.';
COMMENT ON COLUMN public.courses.is_published IS 'Only published courses appear in the learner catalog.';
COMMENT ON COLUMN public.courses.slug         IS 'URL-safe unique identifier for the course.';


-- -----------------------------------------------------------------------------
-- 3.06  modules
-- Ordered curriculum chapters inside a course.
-- is_required: if true, this module counts toward course_progress_pct.
-- Module availability is DERIVED from order_index + previous module status.
-- There is NO is_unlocked column.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modules (
    id          UUID          NOT NULL DEFAULT gen_random_uuid(),
    course_id   UUID          NOT NULL,
    title       VARCHAR(255)  NOT NULL,
    description TEXT          NULL,
    order_index INTEGER       NOT NULL,
    is_required BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_modules               PRIMARY KEY (id),
    CONSTRAINT uq_modules_course_order  UNIQUE (course_id, order_index),

    CONSTRAINT fk_modules_course
        FOREIGN KEY (course_id) REFERENCES public.courses (id)
        ON DELETE CASCADE,

    CONSTRAINT chk_modules_order_positive CHECK (order_index >= 1)
);

COMMENT ON TABLE  public.modules             IS 'Ordered curriculum chapters. Module unlock is derived from order_index by FastAPI.';
COMMENT ON COLUMN public.modules.order_index IS '1-based position within the course. Uniqueness enforced per course.';
COMMENT ON COLUMN public.modules.is_required IS 'Required modules count toward course_progress_pct. Optional modules do not.';


-- -----------------------------------------------------------------------------
-- 3.07  lessons
-- Discrete learning units inside a module.
--
-- FLEXIBLE CONTENT MODEL:
--   content_body  TEXT NULL  -- Freeform text / Markdown
--   video_url     TEXT NULL  -- Link to hosted video
--   document_url  TEXT NULL  -- Link to Supabase Storage PDF or file
--
-- Any combination is valid. No content_type column exists.
-- No fixed ratio (no 60:40 or any other ratio) is enforced.
-- Application rule (FastAPI service layer): at least one content field
-- must be non-null before a lesson is saved as final/published.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lessons (
    id               UUID          NOT NULL DEFAULT gen_random_uuid(),
    module_id        UUID          NOT NULL,
    title            VARCHAR(255)  NOT NULL,
    content_body     TEXT          NULL,
    video_url        TEXT          NULL,
    document_url     TEXT          NULL,
    duration_minutes INTEGER       NOT NULL DEFAULT 0,
    order_index      INTEGER       NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_lessons              PRIMARY KEY (id),
    CONSTRAINT uq_lessons_module_order UNIQUE (module_id, order_index),

    CONSTRAINT fk_lessons_module
        FOREIGN KEY (module_id) REFERENCES public.modules (id)
        ON DELETE CASCADE,

    CONSTRAINT chk_lessons_order_positive    CHECK (order_index >= 1),
    CONSTRAINT chk_lessons_duration_positive CHECK (duration_minutes >= 0)
);

COMMENT ON TABLE  public.lessons              IS 'Discrete learning units. Flexible content: any combination of content_body, video_url, document_url.';
COMMENT ON COLUMN public.lessons.content_body IS 'Nullable. Freeform text or Markdown. No content_type enum; all three fields are independent.';
COMMENT ON COLUMN public.lessons.video_url    IS 'Nullable. External or Supabase-hosted video URL.';
COMMENT ON COLUMN public.lessons.document_url IS 'Nullable. Link to a PDF or file stored in Supabase Storage.';


-- -----------------------------------------------------------------------------
-- 3.08  quizzes
-- Assessment containers. The quiz_type determines which FK is populated.
-- All three CHECK constraints must be satisfied simultaneously.
--
-- Default passing scores (enforced by FastAPI on creation, not DB DEFAULT):
--   MODULE quiz: passing_score = 75.00, max_attempts = 3
--   FINAL  quiz: passing_score = 70.00, max_attempts = 3
--   LESSON quiz: instructor-defined
--
-- Cardinality (1 quiz per lesson/module/course) enforced in Section 5
-- via partial unique indexes.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
    id                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    title               VARCHAR(255) NOT NULL,
    description         TEXT         NULL,
    quiz_type           quiz_type    NOT NULL,

    -- Exactly one of these three must be NOT NULL.
    -- Which one is determined by quiz_type (enforced below).
    lesson_id           UUID         NULL,
    module_id           UUID         NULL,
    course_id           UUID         NULL,

    passing_score       NUMERIC(5,2) NOT NULL,
    max_attempts        INTEGER      NOT NULL DEFAULT 3,
    time_limit_minutes  INTEGER      NULL,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_quizzes PRIMARY KEY (id),

    CONSTRAINT fk_quizzes_lesson
        FOREIGN KEY (lesson_id) REFERENCES public.lessons (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_quizzes_module
        FOREIGN KEY (module_id) REFERENCES public.modules (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_quizzes_course
        FOREIGN KEY (course_id) REFERENCES public.courses (id)
        ON DELETE CASCADE,

    -- CHECK 1: Exactly one target FK is non-null.
    -- Kept explicitly for clarity even though CHECK 2 subsumes it.
    CONSTRAINT chk_quizzes_single_target CHECK (
        (lesson_id  IS NOT NULL)::int
        + (module_id IS NOT NULL)::int
        + (course_id IS NOT NULL)::int = 1
    ),

    -- CHECK 2: quiz_type must exactly match the populated FK.
    -- The database rejects any mismatch (e.g. quiz_type=MODULE with lesson_id set).
    CONSTRAINT chk_quizzes_type_target_alignment CHECK (
        (quiz_type = 'LESSON'
            AND lesson_id  IS NOT NULL
            AND module_id  IS NULL
            AND course_id  IS NULL)
        OR
        (quiz_type = 'MODULE'
            AND module_id  IS NOT NULL
            AND lesson_id  IS NULL
            AND course_id  IS NULL)
        OR
        (quiz_type = 'FINAL'
            AND course_id  IS NOT NULL
            AND lesson_id  IS NULL
            AND module_id  IS NULL)
    ),

    -- CHECK 3: passing_score must be a valid percentage.
    CONSTRAINT chk_quizzes_passing_score CHECK (
        passing_score >= 0.00 AND passing_score <= 100.00
    ),

    -- CHECK 4: max_attempts must be at least 1.
    CONSTRAINT chk_quizzes_max_attempts CHECK (max_attempts >= 1)
);

COMMENT ON TABLE  public.quizzes                    IS 'Assessment containers. quiz_type determines which FK is populated. One quiz per target enforced by partial unique indexes.';
COMMENT ON COLUMN public.quizzes.lesson_id          IS 'Set ONLY when quiz_type = LESSON.';
COMMENT ON COLUMN public.quizzes.module_id          IS 'Set ONLY when quiz_type = MODULE.';
COMMENT ON COLUMN public.quizzes.course_id          IS 'Set ONLY when quiz_type = FINAL.';
COMMENT ON COLUMN public.quizzes.passing_score      IS 'Percentage needed to pass. MODULE default=75.00, FINAL default=70.00 (set by FastAPI).';
COMMENT ON COLUMN public.quizzes.time_limit_minutes IS 'NULL = untimed. Positive integer = minutes allowed per attempt.';


-- -----------------------------------------------------------------------------
-- 3.09  questions
-- Individual question items within a published quiz.
-- Correct answers are stored on question_options (is_correct), never here.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
    id            UUID          NOT NULL DEFAULT gen_random_uuid(),
    quiz_id       UUID          NOT NULL,
    question_text TEXT          NOT NULL,
    question_type question_type NOT NULL DEFAULT 'MCQ',
    explanation   TEXT          NULL,
    points        INTEGER       NOT NULL DEFAULT 1,
    order_index   INTEGER       NOT NULL,

    CONSTRAINT pk_questions              PRIMARY KEY (id),
    CONSTRAINT uq_questions_quiz_order   UNIQUE (quiz_id, order_index),

    CONSTRAINT fk_questions_quiz
        FOREIGN KEY (quiz_id) REFERENCES public.quizzes (id)
        ON DELETE CASCADE,

    CONSTRAINT chk_questions_points      CHECK (points >= 1),
    CONSTRAINT chk_questions_order_positive CHECK (order_index >= 1)
);

COMMENT ON TABLE  public.questions             IS 'Individual question items within a quiz.';
COMMENT ON COLUMN public.questions.explanation IS 'Optional. Shown to learner after submission to explain the correct answer.';
COMMENT ON COLUMN public.questions.points      IS 'Point value used in score calculation. Minimum 1.';


-- -----------------------------------------------------------------------------
-- 3.10  question_options
-- Answer choices for a question.
-- is_correct is used for server-side grading ONLY.
-- FastAPI must never expose is_correct to the learner before submission.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_options (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    question_id UUID        NOT NULL,
    option_text TEXT        NOT NULL,
    is_correct  BOOLEAN     NOT NULL DEFAULT FALSE,
    order_index INTEGER     NOT NULL,

    CONSTRAINT pk_question_options              PRIMARY KEY (id),
    CONSTRAINT uq_question_options_order        UNIQUE (question_id, order_index),

    CONSTRAINT fk_question_options_question
        FOREIGN KEY (question_id) REFERENCES public.questions (id)
        ON DELETE CASCADE,

    CONSTRAINT chk_question_options_order_positive CHECK (order_index >= 1)
);

COMMENT ON TABLE  public.question_options            IS 'Answer choices for a question. is_correct used for server-side grading only.';
COMMENT ON COLUMN public.question_options.is_correct IS 'NEVER sent to learner before submission. Used only for server-side scoring in FastAPI.';


-- -----------------------------------------------------------------------------
-- 3.11  ai_quiz_drafts
-- Quarantine staging area for AI-generated questions.
--
-- CRITICAL RULE: AI output NEVER writes directly to quizzes or questions.
-- All AI output lands here with status = PENDING_REVIEW.
-- Instructor must review, edit if needed, and explicitly approve.
-- Only after APPROVED does FastAPI create rows in quizzes/questions/question_options.
--
-- Workflow: PENDING_REVIEW -> APPROVED | DISCARDED
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_quiz_drafts (
    id               UUID            NOT NULL DEFAULT gen_random_uuid(),
    lesson_id        UUID            NOT NULL,
    instructor_id    UUID            NULL,
    prompt_context   TEXT            NULL,
    raw_llm_response JSONB           NOT NULL,
    status           ai_draft_status NOT NULL DEFAULT 'PENDING_REVIEW',
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    reviewed_at      TIMESTAMPTZ     NULL,

    CONSTRAINT pk_ai_quiz_drafts PRIMARY KEY (id),

    CONSTRAINT fk_ai_quiz_drafts_lesson
        FOREIGN KEY (lesson_id) REFERENCES public.lessons (id)
        ON DELETE CASCADE,

    -- SET NULL: draft is retained for audit if the instructor account is deleted.
    CONSTRAINT fk_ai_quiz_drafts_instructor
        FOREIGN KEY (instructor_id) REFERENCES public.users (id)
        ON DELETE SET NULL
);

COMMENT ON TABLE  public.ai_quiz_drafts                  IS 'AI-generated quiz staging (quarantine). AI writes ONLY here. Instructor must approve before content reaches quizzes/questions.';
COMMENT ON COLUMN public.ai_quiz_drafts.raw_llm_response IS 'Validated structured LLM JSON output. Instructor may edit before approving.';
COMMENT ON COLUMN public.ai_quiz_drafts.prompt_context   IS 'Snapshot of lesson content used as LLM prompt input. Stored for reproducibility.';
COMMENT ON COLUMN public.ai_quiz_drafts.reviewed_at      IS 'Timestamp set when instructor clicks Approve or Discard.';


-- -----------------------------------------------------------------------------
-- 3.12  enrollments
-- User <-> Course registrations.
--
-- IMPORTANT: No derived_progress_pct column.
-- Course progress is ALWAYS calculated dynamically in FastAPI:
--   progress = COMPLETED required modules / total required modules * 100
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrollments (
    id           UUID              NOT NULL DEFAULT gen_random_uuid(),
    user_id      UUID              NOT NULL,
    course_id    UUID              NOT NULL,
    status       enrollment_status NOT NULL DEFAULT 'ACTIVE',
    enrolled_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ       NULL,

    CONSTRAINT pk_enrollments              PRIMARY KEY (id),
    CONSTRAINT uq_enrollments_user_course  UNIQUE (user_id, course_id),

    CONSTRAINT fk_enrollments_user
        FOREIGN KEY (user_id) REFERENCES public.users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_enrollments_course
        FOREIGN KEY (course_id) REFERENCES public.courses (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE  public.enrollments              IS 'User-course registrations. No progress percentage stored; always derived from module_progress.';
COMMENT ON COLUMN public.enrollments.completed_at IS 'Set by FastAPI when all required modules are COMPLETED and FINAL exam is passed.';


-- -----------------------------------------------------------------------------
-- 3.13  module_progress
-- PRIMARY SOURCE OF TRUTH for per-user, per-module learning state.
--
-- IMPORTANT: No is_unlocked column.
-- Module availability is DERIVED from order_index and previous module status.
--
-- Relearning lifecycle (all managed by FastAPI, not triggers):
--   FAILURE (attempts_used >= max_attempts, no pass):
--     - status -> NEEDS_RELEARNING
--     - relearning_triggered_at -> NOW()
--     - lesson_progress.is_completed -> false (all lessons reset)
--     - attempts_used -> UNCHANGED at this point (still at max)
--     - quiz_attempts -> UNTOUCHED (immutable history preserved)
--   RE-ENGAGEMENT (user re-completes all lessons):
--     - status -> IN_PROGRESS
--     - attempts_used -> 0  (reset happens HERE, not at failure)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.module_progress (
    id                       UUID                   NOT NULL DEFAULT gen_random_uuid(),
    enrollment_id            UUID                   NOT NULL,
    module_id                UUID                   NOT NULL,
    status                   module_progress_status NOT NULL DEFAULT 'NOT_STARTED',
    attempts_used            INTEGER                NOT NULL DEFAULT 0,
    started_at               TIMESTAMPTZ            NULL,
    completed_at             TIMESTAMPTZ            NULL,
    relearning_triggered_at  TIMESTAMPTZ            NULL,

    CONSTRAINT pk_module_progress                      PRIMARY KEY (id),
    CONSTRAINT uq_module_progress_enrollment_module    UNIQUE (enrollment_id, module_id),

    CONSTRAINT fk_module_progress_enrollment
        FOREIGN KEY (enrollment_id) REFERENCES public.enrollments (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_module_progress_module
        FOREIGN KEY (module_id) REFERENCES public.modules (id)
        ON DELETE CASCADE,

    CONSTRAINT chk_module_progress_attempts CHECK (attempts_used >= 0)
);

COMMENT ON TABLE  public.module_progress                         IS 'Primary source of truth for module learning state. No is_unlocked column; availability derived by FastAPI.';
COMMENT ON COLUMN public.module_progress.attempts_used           IS 'Resets to 0 when new cycle begins (after relearning). NOT reset at failure event.';
COMMENT ON COLUMN public.module_progress.relearning_triggered_at IS 'Set when status -> NEEDS_RELEARNING. FastAPI manages subsequent lesson reset and cycle restart.';


-- -----------------------------------------------------------------------------
-- 3.14  lesson_progress
-- Granular lesson-level completion tracking within a module learning cycle.
--
-- Ownership rule (enforced by FastAPI service layer, not database):
--   lesson_id must belong to module_progress.module_id.
--   FastAPI validates this before creating or updating any record.
--
-- On relearning trigger: FastAPI sets is_completed = false and
-- completed_at = null for all lesson_progress rows under the affected
-- module_progress record. quiz_attempts are NOT touched.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    module_progress_id  UUID        NOT NULL,
    lesson_id           UUID        NOT NULL,
    is_completed        BOOLEAN     NOT NULL DEFAULT FALSE,
    completed_at        TIMESTAMPTZ NULL,

    CONSTRAINT pk_lesson_progress                PRIMARY KEY (id),
    CONSTRAINT uq_lesson_progress_module_lesson  UNIQUE (module_progress_id, lesson_id),

    CONSTRAINT fk_lesson_progress_module_progress
        FOREIGN KEY (module_progress_id) REFERENCES public.module_progress (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_lesson_progress_lesson
        FOREIGN KEY (lesson_id) REFERENCES public.lessons (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE  public.lesson_progress              IS 'Lesson completion tracking per module cycle. Flags reset by FastAPI on NEEDS_RELEARNING.';
COMMENT ON COLUMN public.lesson_progress.is_completed IS 'Reset to false by FastAPI when parent module_progress enters NEEDS_RELEARNING.';


-- -----------------------------------------------------------------------------
-- 3.15  quiz_attempts
-- APPEND-ONLY historical audit log of every quiz submission.
-- Records MUST NEVER be updated or deleted after insertion.
--
-- attempt_number: globally sequential per (user_id, quiz_id) across all cycles.
--   Example: 3 failed attempts (cycle 1) + 1 passed attempt (cycle 2) = 4 records
--   attempt_numbers: 1, 2, 3, 4
--
-- attempt_cycle: increments with each relearning cycle.
--   Example: cycle=1 for attempts 1-3, cycle=2 for attempt 4.
--
-- module_progress_id:
--   - Set for MODULE quiz attempts (links to the relearning cycle context).
--   - NULL for LESSON and FINAL quiz attempts (not cycle-bound).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    user_id             UUID         NOT NULL,
    quiz_id             UUID         NOT NULL,
    module_progress_id  UUID         NULL,
    attempt_number      INTEGER      NOT NULL,
    attempt_cycle       INTEGER      NOT NULL DEFAULT 1,
    score_achieved      NUMERIC(5,2) NOT NULL,
    is_passed           BOOLEAN      NOT NULL,
    submitted_answers   JSONB        NOT NULL,
    started_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    submitted_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_quiz_attempts PRIMARY KEY (id),

    CONSTRAINT fk_quiz_attempts_user
        FOREIGN KEY (user_id) REFERENCES public.users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_quiz_attempts_quiz
        FOREIGN KEY (quiz_id) REFERENCES public.quizzes (id)
        ON DELETE RESTRICT,

    -- SET NULL: retain attempt history even if module_progress is deleted.
    CONSTRAINT fk_quiz_attempts_module_progress
        FOREIGN KEY (module_progress_id) REFERENCES public.module_progress (id)
        ON DELETE SET NULL,

    -- Enforce uniqueness of sequential attempt numbers per user and quiz.
    CONSTRAINT uq_quiz_attempts_user_quiz_attempt UNIQUE (user_id, quiz_id, attempt_number),

    CONSTRAINT chk_quiz_attempts_attempt_number CHECK (attempt_number >= 1),
    CONSTRAINT chk_quiz_attempts_attempt_cycle  CHECK (attempt_cycle >= 1),
    CONSTRAINT chk_quiz_attempts_score CHECK (
        score_achieved >= 0.00 AND score_achieved <= 100.00
    )
);

COMMENT ON TABLE  public.quiz_attempts                   IS 'Append-only audit log. Records MUST NOT be updated or deleted.';
COMMENT ON COLUMN public.quiz_attempts.attempt_number    IS 'Globally sequential per (user_id, quiz_id) across all relearning cycles.';
COMMENT ON COLUMN public.quiz_attempts.attempt_cycle     IS 'Cycle 1 = initial attempts. Increments on each new relearning cycle.';
COMMENT ON COLUMN public.quiz_attempts.submitted_answers IS 'Immutable JSONB snapshot: [{question_id, selected_option_ids, is_correct}].';
COMMENT ON COLUMN public.quiz_attempts.module_progress_id IS 'Links MODULE quiz attempts to their relearning cycle. NULL for LESSON/FINAL quizzes.';


-- -----------------------------------------------------------------------------
-- 3.16  certificates
-- Issued only after all of the following are true (evaluated by FastAPI):
--   (a) All required module_progress records have status = COMPLETED
--   (b) A quiz_attempt exists for the FINAL quiz with is_passed = true
--   (c) enrollments.status is set to COMPLETED
-- One certificate per enrollment only (enforced by UNIQUE on enrollment_id).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certificates (
    id                 UUID         NOT NULL DEFAULT gen_random_uuid(),
    enrollment_id      UUID         NOT NULL,
    user_id            UUID         NOT NULL,
    course_id          UUID         NOT NULL,
    certificate_number VARCHAR(100) NOT NULL,
    issued_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    pdf_storage_path   TEXT         NULL,
    verification_hash  VARCHAR(64)  NOT NULL,

    CONSTRAINT pk_certificates            PRIMARY KEY (id),
    CONSTRAINT uq_certificates_enrollment UNIQUE (enrollment_id),
    CONSTRAINT uq_certificates_number     UNIQUE (certificate_number),
    CONSTRAINT uq_certificates_hash       UNIQUE (verification_hash),

    CONSTRAINT fk_certificates_enrollment
        FOREIGN KEY (enrollment_id) REFERENCES public.enrollments (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_certificates_user
        FOREIGN KEY (user_id) REFERENCES public.users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_certificates_course
        FOREIGN KEY (course_id) REFERENCES public.courses (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE  public.certificates                    IS 'Issued after all required modules COMPLETED and FINAL exam passed.';
COMMENT ON COLUMN public.certificates.certificate_number IS 'Human-readable unique ID, e.g. DC-2026-ABCD-1234.';
COMMENT ON COLUMN public.certificates.verification_hash  IS 'SHA-256 of (user_id || course_id || issued_at). For verification endpoint.';
COMMENT ON COLUMN public.certificates.pdf_storage_path   IS 'Path in Supabase Storage certificates bucket. NULL until PDF is generated.';


-- =============================================================================
-- SECTION 4: ADDITIONAL NAMED CONSTRAINTS
-- All constraints are fully defined inline in Section 3.
-- No additional constraints are required beyond those already created above.
-- This section is reserved for future constraint additions.
-- =============================================================================

-- (No additional constraints. All CHECKs, UNIQUEs, and FKs are inline above.)


-- =============================================================================
-- SECTION 5: INDEXES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5.A  Quiz Cardinality — Partial Unique Indexes
-- Enforce the rule of maximum one quiz per lesson, module, and course.
-- The WHERE clause scopes uniqueness to each quiz_type, so a LESSON quiz
-- and a MODULE quiz on different rows do not conflict.
-- -----------------------------------------------------------------------------

-- Maximum 1 LESSON quiz per lesson.
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_per_lesson
    ON public.quizzes (lesson_id)
    WHERE quiz_type = 'LESSON';

-- Maximum 1 MODULE quiz per module.
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_per_module
    ON public.quizzes (module_id)
    WHERE quiz_type = 'MODULE';

-- Maximum 1 FINAL quiz per course.
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_per_course_final
    ON public.quizzes (course_id)
    WHERE quiz_type = 'FINAL';


-- -----------------------------------------------------------------------------
-- 5.B  Performance Indexes
-- Targeting the most frequent query patterns used by the FastAPI service layer.
-- -----------------------------------------------------------------------------

-- Fast lookup of all sub-domains within a given domain.
-- Used in: domain catalog, onboarding sub-domain selection.
CREATE INDEX IF NOT EXISTS idx_sub_domains_domain
    ON public.sub_domains (domain_id);

-- Fast discovery of published courses within a sub-domain.
-- Partial index: only indexes published=true rows to minimize size.
-- Used in: learner catalog, personalized course discovery.
CREATE INDEX IF NOT EXISTS idx_courses_sub_domain_published
    ON public.courses (sub_domain_id)
    WHERE is_published = TRUE;

-- Fast lookup of all interest records for a given user.
-- Used in: personalized discovery (user_interests -> sub_domains -> courses).
CREATE INDEX IF NOT EXISTS idx_user_interests_user
    ON public.user_interests (user_id);

-- NOTE: idx_modules_course_order is intentionally omitted.
-- The UNIQUE (course_id, order_index) constraint on modules already
-- creates an equivalent B-tree index; a separate index would be redundant.

-- NOTE: idx_lessons_module_order is intentionally omitted.
-- The UNIQUE (module_id, order_index) constraint on lessons already
-- creates an equivalent B-tree index; a separate index would be redundant.

-- Fast lookup of module progress records for an enrollment, filtered by status.
-- Used in: course progress calculation, final exam unlock check.
CREATE INDEX IF NOT EXISTS idx_module_progress_enrollment_status
    ON public.module_progress (enrollment_id, status);

-- NOTE: idx_quiz_attempts_user_quiz is intentionally omitted.
-- The UNIQUE (user_id, quiz_id, attempt_number) constraint on quiz_attempts
-- creates an index on (user_id, quiz_id, attempt_number) whose leading columns
-- already cover queries on (user_id, quiz_id).

-- Fast certificate lookup by verification hash.
-- Used in: certificate verification endpoint.
CREATE INDEX IF NOT EXISTS idx_certificates_verification_hash
    ON public.certificates (verification_hash);


-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
