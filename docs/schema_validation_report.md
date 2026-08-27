# Schema Validation Report
**File:** `docs/database_schema.sql`  
**Validated Against:** `data_model_spec.md` v5.0  
**Date:** 2026-08-27  
**Result:** ✅ SCHEMA PASSES FULL VALIDATION — with 3 observations to review before execution

---

## 1. Enum Types (7/7)

| Enum | Values in Spec | Values in SQL | Status |
|------|---------------|---------------|--------|
| `user_role` | ADMIN, INSTRUCTOR, USER | ADMIN, INSTRUCTOR, USER | ✅ |
| `difficulty_level` | BEGINNER, INTERMEDIATE, ADVANCED | BEGINNER, INTERMEDIATE, ADVANCED | ✅ |
| `quiz_type` | LESSON, MODULE, FINAL | LESSON, MODULE, FINAL | ✅ |
| `question_type` | MCQ, MULTI_SELECT, TRUE_FALSE | MCQ, MULTI_SELECT, TRUE_FALSE | ✅ |
| `ai_draft_status` | PENDING_REVIEW, APPROVED, DISCARDED | PENDING_REVIEW, APPROVED, DISCARDED | ✅ |
| `enrollment_status` | ACTIVE, COMPLETED, DROPPED | ACTIVE, COMPLETED, DROPPED | ✅ |
| `module_progress_status` | NOT_STARTED, IN_PROGRESS, COMPLETED, NEEDS_RELEARNING | NOT_STARTED, IN_PROGRESS, COMPLETED, NEEDS_RELEARNING | ✅ |

---

## 2. Table Presence and Creation Order (16/16)

All 16 tables present in correct dependency order:

| # | Table | Depends On | Status |
|---|-------|-----------|--------|
| 1 | `users` | `auth.users` | ✅ |
| 2 | `domains` | — | ✅ |
| 3 | `sub_domains` | `domains` | ✅ |
| 4 | `user_interests` | `users`, `sub_domains` | ✅ |
| 5 | `courses` | `users`, `sub_domains` | ✅ |
| 6 | `modules` | `courses` | ✅ |
| 7 | `lessons` | `modules` | ✅ |
| 8 | `quizzes` | `lessons`, `modules`, `courses` | ✅ |
| 9 | `questions` | `quizzes` | ✅ |
| 10 | `question_options` | `questions` | ✅ |
| 11 | `ai_quiz_drafts` | `lessons`, `users` | ✅ |
| 12 | `enrollments` | `users`, `courses` | ✅ |
| 13 | `module_progress` | `enrollments`, `modules` | ✅ |
| 14 | `lesson_progress` | `module_progress`, `lessons` | ✅ |
| 15 | `quiz_attempts` | `users`, `quizzes`, `module_progress` | ✅ |
| 16 | `certificates` | `enrollments`, `users`, `courses` | ✅ |

---

## 3. Column-by-Column Verification

### `users`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK, refs auth.users ON DELETE CASCADE | ✅ | ✅ |
| `email` | VARCHAR(255) UNIQUE NOT NULL | ✅ | ✅ |
| `full_name` | VARCHAR(255) NOT NULL | ✅ | ✅ |
| `role` | user_role NOT NULL DEFAULT 'USER' | ✅ | ✅ |
| `avatar_url` | TEXT NULL | ✅ | ✅ |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | ✅ | ✅ |
| `updated_at` | TIMESTAMPTZ DEFAULT NOW() | ✅ | ✅ |

### `domains`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK DEFAULT gen_random_uuid() | ✅ | ✅ |
| `name` | VARCHAR(100) UNIQUE NOT NULL | ✅ | ✅ |
| `slug` | VARCHAR(100) UNIQUE NOT NULL | ✅ | ✅ |
| `description` | TEXT NULL | ✅ | ✅ |
| `icon_url` | TEXT NULL | ✅ | ✅ |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | ✅ | ✅ |

### `sub_domains`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `domain_id` | UUID FK→domains ON DELETE RESTRICT NOT NULL | ✅ | ✅ |
| `name` | VARCHAR(150) NOT NULL | ✅ | ✅ |
| `slug` | VARCHAR(150) UNIQUE NOT NULL | ✅ | ✅ |
| `description` | TEXT NULL | ✅ | ✅ |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | ✅ | ✅ |

### `user_interests`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `user_id` | UUID FK→users ON DELETE CASCADE | ✅ | ✅ |
| `sub_domain_id` | UUID FK→sub_domains ON DELETE CASCADE | ✅ | ✅ |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | ✅ | ✅ |
| UNIQUE | `(user_id, sub_domain_id)` | ✅ | ✅ |

### `courses`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `instructor_id` | UUID FK→users ON DELETE RESTRICT | ✅ | ✅ |
| `sub_domain_id` | UUID FK→sub_domains ON DELETE RESTRICT NOT NULL | ✅ | ✅ |
| `title` | VARCHAR(255) NOT NULL | ✅ | ✅ |
| `slug` | VARCHAR(255) UNIQUE NOT NULL | ✅ | ✅ |
| `description` | TEXT NOT NULL | ✅ | ✅ |
| `thumbnail_url` | TEXT NULL | ✅ | ✅ |
| `difficulty_level` | difficulty_level NULL | ✅ | ✅ |
| `is_published` | BOOLEAN DEFAULT false | ✅ | ✅ |
| `created_at` / `updated_at` | TIMESTAMPTZ | ✅ | ✅ |
| `final_exam_id` | **MUST NOT EXIST** | Absent ✅ | ✅ |

### `modules`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `course_id` | UUID FK→courses ON DELETE CASCADE NOT NULL | ✅ | ✅ |
| `title` | VARCHAR(255) NOT NULL | ✅ | ✅ |
| `description` | TEXT NULL | ✅ | ✅ |
| `order_index` | INTEGER NOT NULL | ✅ | ✅ |
| `is_required` | BOOLEAN DEFAULT true | ✅ | ✅ |
| `created_at` | TIMESTAMPTZ | ✅ | ✅ |
| UNIQUE | `(course_id, order_index)` | ✅ | ✅ |
| CHECK | `order_index >= 1` | ✅ (chk_modules_order_positive) | ✅ |

### `lessons` — Flexible Content Model
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `module_id` | UUID FK→modules ON DELETE CASCADE NOT NULL | ✅ | ✅ |
| `title` | VARCHAR(255) NOT NULL | ✅ | ✅ |
| `content_body` | TEXT **NULL** | ✅ | ✅ |
| `video_url` | TEXT **NULL** | ✅ | ✅ |
| `document_url` | TEXT **NULL** | ✅ | ✅ |
| `content_type` | **MUST NOT EXIST** | Absent ✅ | ✅ |
| `duration_minutes` | INTEGER DEFAULT 0 | ✅ | ✅ |
| `order_index` | INTEGER NOT NULL | ✅ | ✅ |
| `created_at` | TIMESTAMPTZ | ✅ | ✅ |
| UNIQUE | `(module_id, order_index)` | ✅ | ✅ |

### `quizzes`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `title` | VARCHAR(255) NOT NULL | ✅ | ✅ |
| `description` | TEXT NULL | ✅ | ✅ |
| `quiz_type` | quiz_type NOT NULL | ✅ | ✅ |
| `lesson_id` | UUID NULL FK→lessons CASCADE | ✅ | ✅ |
| `module_id` | UUID NULL FK→modules CASCADE | ✅ | ✅ |
| `course_id` | UUID NULL FK→courses CASCADE | ✅ | ✅ |
| `passing_score` | NUMERIC(5,2) NOT NULL | ✅ | ✅ |
| `max_attempts` | INTEGER NOT NULL DEFAULT 3 | ✅ | ✅ |
| `time_limit_minutes` | INTEGER NULL | ✅ | ✅ |
| `is_active` | BOOLEAN DEFAULT true | ✅ | ✅ |
| `created_at` | TIMESTAMPTZ | ✅ | ✅ |

### `questions`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `quiz_id` | UUID FK→quizzes ON DELETE CASCADE NOT NULL | ✅ | ✅ |
| `question_text` | TEXT NOT NULL | ✅ | ✅ |
| `question_type` | question_type DEFAULT 'MCQ' | ✅ | ✅ |
| `explanation` | TEXT NULL | ✅ | ✅ |
| `points` | INTEGER DEFAULT 1 | ✅ | ✅ |
| `order_index` | INTEGER NOT NULL | ✅ | ✅ |
| UNIQUE | `(quiz_id, order_index)` | ✅ | ✅ |

### `question_options`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `question_id` | UUID FK→questions ON DELETE CASCADE | ✅ | ✅ |
| `option_text` | TEXT NOT NULL | ✅ | ✅ |
| `is_correct` | BOOLEAN NOT NULL DEFAULT false | ✅ | ✅ |
| `order_index` | INTEGER NOT NULL | ✅ | ✅ |
| UNIQUE | `(question_id, order_index)` | ✅ | ✅ |

### `ai_quiz_drafts`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `lesson_id` | UUID FK→lessons ON DELETE CASCADE NOT NULL | ✅ | ✅ |
| `instructor_id` | UUID FK→users ON DELETE SET NULL NULL | ✅ | ✅ |
| `prompt_context` | TEXT NULL | ✅ | ✅ |
| `raw_llm_response` | JSONB NOT NULL | ✅ | ✅ |
| `status` | ai_draft_status DEFAULT 'PENDING_REVIEW' | ✅ | ✅ |
| `created_at` | TIMESTAMPTZ | ✅ | ✅ |
| `reviewed_at` | TIMESTAMPTZ NULL | ✅ | ✅ |

### `enrollments`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `user_id` | UUID FK→users ON DELETE CASCADE | ✅ | ✅ |
| `course_id` | UUID FK→courses ON DELETE CASCADE | ✅ | ✅ |
| `status` | enrollment_status DEFAULT 'ACTIVE' | ✅ | ✅ |
| `enrolled_at` | TIMESTAMPTZ DEFAULT NOW() | ✅ | ✅ |
| `completed_at` | TIMESTAMPTZ NULL | ✅ | ✅ |
| `derived_progress_pct` | **MUST NOT EXIST** | Absent ✅ | ✅ |
| UNIQUE | `(user_id, course_id)` | ✅ | ✅ |

### `module_progress`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `enrollment_id` | UUID FK→enrollments ON DELETE CASCADE | ✅ | ✅ |
| `module_id` | UUID FK→modules ON DELETE CASCADE | ✅ | ✅ |
| `status` | module_progress_status DEFAULT 'NOT_STARTED' | ✅ | ✅ |
| `attempts_used` | INTEGER DEFAULT 0 | ✅ | ✅ |
| `started_at` | TIMESTAMPTZ NULL | ✅ | ✅ |
| `completed_at` | TIMESTAMPTZ NULL | ✅ | ✅ |
| `relearning_triggered_at` | TIMESTAMPTZ NULL | ✅ | ✅ |
| `is_unlocked` | **MUST NOT EXIST** | Absent ✅ | ✅ |
| UNIQUE | `(enrollment_id, module_id)` | ✅ | ✅ |
| CHECK | `attempts_used >= 0` | ✅ | ✅ |

### `lesson_progress`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `module_progress_id` | UUID FK→module_progress ON DELETE CASCADE | ✅ | ✅ |
| `lesson_id` | UUID FK→lessons ON DELETE CASCADE | ✅ | ✅ |
| `is_completed` | BOOLEAN DEFAULT false | ✅ | ✅ |
| `completed_at` | TIMESTAMPTZ NULL | ✅ | ✅ |
| UNIQUE | `(module_progress_id, lesson_id)` | ✅ | ✅ |

### `quiz_attempts`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `user_id` | UUID FK→users ON DELETE CASCADE | ✅ | ✅ |
| `quiz_id` | UUID FK→quizzes **ON DELETE RESTRICT** | ✅ (last correction applied) | ✅ |
| `module_progress_id` | UUID FK→module_progress ON DELETE SET NULL NULL | ✅ | ✅ |
| `attempt_number` | INTEGER NOT NULL | ✅ | ✅ |
| `attempt_cycle` | INTEGER NOT NULL DEFAULT 1 | ✅ | ✅ |
| `score_achieved` | NUMERIC(5,2) NOT NULL | ✅ | ✅ |
| `is_passed` | BOOLEAN NOT NULL | ✅ | ✅ |
| `submitted_answers` | JSONB NOT NULL | ✅ | ✅ |
| `started_at` | TIMESTAMPTZ DEFAULT NOW() | ✅ | ✅ |
| `submitted_at` | TIMESTAMPTZ DEFAULT NOW() | ✅ | ✅ |
| UNIQUE | `(user_id, quiz_id, attempt_number)` | ✅ (`uq_quiz_attempts_user_quiz_attempt`) | ✅ |
| CHECK `attempt_number >= 1` | ✅ | ✅ |
| CHECK `attempt_cycle >= 1` | ✅ | ✅ |
| CHECK `score_achieved 0–100` | ✅ | ✅ |

### `certificates`
| Column | Spec | SQL | Status |
|--------|------|-----|--------|
| `id` | UUID PK | ✅ | ✅ |
| `enrollment_id` | UUID UNIQUE FK→enrollments ON DELETE CASCADE | ✅ | ✅ |
| `user_id` | UUID FK→users ON DELETE CASCADE | ✅ | ✅ |
| `course_id` | UUID FK→courses ON DELETE CASCADE | ✅ | ✅ |
| `certificate_number` | VARCHAR(100) UNIQUE NOT NULL | ✅ | ✅ |
| `issued_at` | TIMESTAMPTZ DEFAULT NOW() | ✅ | ✅ |
| `pdf_storage_path` | TEXT NULL | ✅ | ✅ |
| `verification_hash` | VARCHAR(64) UNIQUE NOT NULL | ✅ | ✅ |

---

## 4. Quiz Integrity Rules

| Rule | Expected | SQL | Status |
|------|----------|-----|--------|
| CHECK 1 — exactly one FK non-null | `(lesson_id IS NOT NULL)::int + (module_id IS NOT NULL)::int + (course_id IS NOT NULL)::int = 1` | `chk_quizzes_single_target` ✅ | ✅ |
| CHECK 2 — type-to-target alignment | LESSON→lesson_id, MODULE→module_id, FINAL→course_id | `chk_quizzes_type_target_alignment` ✅ | ✅ |
| CHECK 3 — score range | 0.00–100.00 | `chk_quizzes_passing_score` ✅ | ✅ |
| CHECK 4 — max_attempts ≥ 1 | `max_attempts >= 1` | `chk_quizzes_max_attempts` ✅ | ✅ |
| Max 1 LESSON quiz per lesson | Partial unique index | `uq_quiz_per_lesson` ✅ | ✅ |
| Max 1 MODULE quiz per module | Partial unique index | `uq_quiz_per_module` ✅ | ✅ |
| Max 1 FINAL quiz per course | Partial unique index | `uq_quiz_per_course_final` ✅ | ✅ |
| No `final_exam_id` on courses | Absent | Not present ✅ | ✅ |

---

## 5. ON DELETE Behavior Audit

| FK Constraint | Behavior | Rationale | Correct? |
|--------------|----------|-----------|---------|
| `fk_users_auth` (users→auth.users) | CASCADE | Delete auth identity → delete platform profile | ✅ |
| `fk_sub_domains_domain` | RESTRICT | Cannot delete domain with sub-domains | ✅ |
| `fk_user_interests_user` | CASCADE | Delete user → delete their interests | ✅ |
| `fk_user_interests_sub_domain` | CASCADE | Delete sub-domain → remove matching interests | ✅ |
| `fk_courses_instructor` | RESTRICT | Cannot delete instructor with owned courses | ✅ |
| `fk_courses_sub_domain` | RESTRICT | Cannot delete sub-domain with courses | ✅ |
| `fk_modules_course` | CASCADE | Delete course → cascade delete modules | ✅ |
| `fk_lessons_module` | CASCADE | Delete module → cascade delete lessons | ✅ |
| `fk_quizzes_lesson` | CASCADE | Delete lesson → delete its quiz | ✅ |
| `fk_quizzes_module` | CASCADE | Delete module → delete its quiz | ✅ |
| `fk_quizzes_course` | CASCADE | Delete course → delete its FINAL quiz | ✅ |
| `fk_questions_quiz` | CASCADE | Delete quiz → delete its questions | ✅ |
| `fk_question_options_question` | CASCADE | Delete question → delete its options | ✅ |
| `fk_ai_quiz_drafts_lesson` | CASCADE | Delete lesson → delete its AI drafts | ✅ |
| `fk_ai_quiz_drafts_instructor` | SET NULL | Retain draft audit if instructor deleted | ✅ |
| `fk_enrollments_user` | CASCADE | Delete user → remove enrollments | ✅ |
| `fk_enrollments_course` | CASCADE | Delete course → remove enrollments | ✅ |
| `fk_module_progress_enrollment` | CASCADE | Delete enrollment → delete its progress | ✅ |
| `fk_module_progress_module` | CASCADE | Delete module → delete progress records | ✅ |
| `fk_lesson_progress_module_progress` | CASCADE | Delete module_progress → delete lesson records | ✅ |
| `fk_lesson_progress_lesson` | CASCADE | Delete lesson → delete its progress rows | ✅ |
| `fk_quiz_attempts_user` | CASCADE | Delete user → delete their attempts | ✅ |
| `fk_quiz_attempts_quiz` | **RESTRICT** | **Cannot delete a quiz with attempt history** | ✅ |
| `fk_quiz_attempts_module_progress` | SET NULL | Retain attempt history if cycle record deleted | ✅ |
| `fk_certificates_enrollment` | CASCADE | Delete enrollment → delete certificate | ✅ |
| `fk_certificates_user` | CASCADE | Delete user → delete their certificates | ✅ |
| `fk_certificates_course` | CASCADE | Delete course → delete certificates | ✅ |

---

## 6. Business Logic Delegation (No Triggers)

| Rule | Where Enforced | In SQL? | Status |
|------|---------------|---------|--------|
| Course progress calculation (dynamic) | FastAPI | No triggers ✅ | ✅ |
| Module availability from order_index | FastAPI | No triggers ✅ | ✅ |
| Final exam unlock at 80% | FastAPI | No triggers ✅ | ✅ |
| Quiz grading / score calculation | FastAPI | No triggers ✅ | ✅ |
| Certificate issuance check | FastAPI | No triggers ✅ | ✅ |
| Relearning lifecycle transitions | FastAPI | No triggers ✅ | ✅ |
| Cross-entity ownership validation | FastAPI | No triggers ✅ | ✅ |
| `updated_at` column maintenance | FastAPI | No triggers ✅ | ✅ |
| AI draft → quiz promotion | FastAPI | No triggers ✅ | ✅ |

**Total triggers in schema: 0** ✅

---

## 7. Banned Columns Verification

| Banned Column | Present as Column Definition? |
|---|---|
| `courses.final_exam_id` | ❌ Not a column (only in SQL comments) ✅ |
| `enrollments.derived_progress_pct` | ❌ Not a column (only in SQL comments) ✅ |
| `module_progress.is_unlocked` | ❌ Not a column (only in SQL comments) ✅ |
| `lessons.content_type` | ❌ Not a column (only in SQL comments) ✅ |

---

## 8. Indexes Verification

| Index | Type | Status |
|-------|------|--------|
| `uq_quiz_per_lesson` | Partial UNIQUE WHERE quiz_type='LESSON' | ✅ |
| `uq_quiz_per_module` | Partial UNIQUE WHERE quiz_type='MODULE' | ✅ |
| `uq_quiz_per_course_final` | Partial UNIQUE WHERE quiz_type='FINAL' | ✅ |
| `idx_sub_domains_domain` | Performance | ✅ |
| `idx_courses_sub_domain_published` | Partial performance (is_published=TRUE) | ✅ |
| `idx_user_interests_user` | Performance | ✅ |
| `idx_modules_course_order` | **Intentionally omitted** — covered by UNIQUE constraint | ✅ |
| `idx_lessons_module_order` | **Intentionally omitted** — covered by UNIQUE constraint | ✅ |
| `idx_module_progress_enrollment_status` | Performance | ✅ |
| `idx_quiz_attempts_user_quiz` | Performance | ✅ |
| `idx_certificates_verification_hash` | Performance | ✅ |

---

## 9. RLS (Row Level Security) — Gap Analysis

> [!IMPORTANT]
> **RLS policies are NOT present in the schema.** This is a known gap that must be addressed before production use.

### Current State
The schema creates all tables in the `public` schema. Supabase enables RLS on `public` tables by default, but **no policies are defined**. This means:

- If RLS is enabled (Supabase default for new projects): **all rows are inaccessible** from the Supabase client SDK without policies.
- FastAPI connects using the **service role key** (bypasses RLS), so **FastAPI endpoints work correctly without policies**.
- If the Supabase client SDK is ever used directly from the frontend, RLS policies would be needed.

### Recommendation for MVP
Since **all data access goes through FastAPI** (which uses the service role and bypasses RLS), RLS policies are **not required for the MVP to function**. However, they are strongly recommended as a security hardening layer.

**Suggested approach for now:**
1. Execute the schema as-is (RLS is not blocking for FastAPI-only access).
2. Add a dedicated `rls_policies.sql` migration as a follow-up, covering the most sensitive tables: `quiz_attempts`, `certificates`, `question_options` (is_correct column), `enrollments`.

---

## 10. Supabase Compatibility

| Concern | Status |
|---------|--------|
| `auth.users` FK reference | ✅ Valid in Supabase Postgres |
| `gen_random_uuid()` default | ✅ Available natively in Supabase (PG14+) |
| `DO $$ BEGIN ... EXCEPTION` idempotency | ✅ Standard PL/pgSQL |
| `CREATE TABLE IF NOT EXISTS` | ✅ Safe to rerun |
| `CREATE INDEX IF NOT EXISTS` | ✅ Safe to rerun |
| `JSONB` column type | ✅ Fully supported |
| `NUMERIC(5,2)` | ✅ Fully supported |
| `TIMESTAMPTZ` | ✅ Supabase stores in UTC |
| Custom ENUM types | ✅ Supported (wrapped in idempotent DO blocks) |
| Partial unique indexes with WHERE clause | ✅ Fully supported in PostgreSQL |
| No triggers | ✅ Clean — nothing to conflict with Supabase internals |

---

## 11. Summary

### ✅ PASS — All spec requirements are correctly implemented

| Category | Count | Result |
|----------|:-----:|--------|
| Enum types | 7/7 | ✅ All correct |
| Tables | 16/16 | ✅ All correct |
| Banned columns absent | 4/4 | ✅ None present as column definitions |
| Flexible lesson content (3 nullable fields) | 3/3 | ✅ content_body, video_url, document_url |
| Quiz CHECK constraints | 4/4 | ✅ All implemented |
| Partial unique indexes (cardinality) | 3/3 | ✅ All implemented |
| Performance indexes | 6/6 | ✅ All implemented |
| Redundant indexes removed | 2/2 | ✅ Covered by UNIQUE constraints |
| ON DELETE behaviors | 27/27 | ✅ All correct |
| Triggers | 0 | ✅ No triggers |
| Seed data | 0 | ✅ None |
| RLS policies | 0 | ⚠️ See Observation 1 below |

---

### Observations (Not Blocking — No Schema Changes Required)

> [!NOTE]
> **Observation 1 — RLS Policies Missing (Expected for MVP)**  
> No RLS policies are defined. FastAPI (service role) bypasses RLS, so the MVP works correctly. A dedicated `rls_policies.sql` should be created as a follow-up hardening step before production launch.

> [!NOTE]
> **Observation 2 — `updated_at` not maintained by trigger (Expected)**  
> `courses.updated_at` and `users.updated_at` must be manually set by FastAPI on every UPDATE. There is no `BEFORE UPDATE` trigger to auto-update these. This is correct per the spec (no triggers), but FastAPI must not forget to set these fields.

> [!NOTE]
> **Observation 3 — `quiz_attempts` composite UNIQUE `(user_id, quiz_id, attempt_number)` (RESOLVED ✅)**  
> The composite constraint `CONSTRAINT uq_quiz_attempts_user_quiz_attempt UNIQUE (user_id, quiz_id, attempt_number)` has been added to `public.quiz_attempts`.

---

### Final Readiness

The schema is 100% verified, self-consistent, and ready to execute against Supabase when approved.
