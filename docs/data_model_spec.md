# DataCaliper Training Platform — Final Approved Data Model Specification

> **Status:** Final — Pending SQL Generation  
> **Version:** 5.0 — Final Corrections Applied

---

## A. Entity List (16 Entities)

| # | Entity | Role |
|---|--------|------|
| 1 | `users` | User profile synced from Supabase Auth |
| 2 | `domains` | Top-level subject areas (Finance, Software & IT, Electronics, …) |
| 3 | `sub_domains` | Specific topics belonging to exactly one domain |
| 4 | `user_interests` | Normalized user ↔ sub-domain interest mapping |
| 5 | `courses` | Training programs belonging to exactly one sub-domain |
| 6 | `modules` | Ordered curriculum chapters inside a course |
| 7 | `lessons` | Discrete learning units inside a module |
| 8 | `quizzes` | Assessment containers (`LESSON` / `MODULE` / `FINAL`) |
| 9 | `questions` | Individual items inside a published quiz |
| 10 | `question_options` | Answer choices for a question |
| 11 | `ai_quiz_drafts` | AI-generated question staging area (quarantine only) |
| 12 | `enrollments` | User ↔ Course registrations |
| 13 | `module_progress` | **Primary source of truth** for learning state and relearning |
| 14 | `lesson_progress` | Granular lesson-level completion tracking |
| 15 | `quiz_attempts` | Immutable, append-only historical log of every submission |
| 16 | `certificates` | Completion credentials issued after all requirements are met |

---

## B. Entity Relationships

### Taxonomy Hierarchy
```
domains (1)
  └──── (*) sub_domains (1)
                └──── (*) courses
```

### User Personalization
```
users (1)
  └──── (*) user_interests (*) ──── (1) sub_domains
                                          │
                                          └── parent domain derived via sub_domains.domain_id
```

### Course Content Hierarchy
```
courses (1)
  ├──── (*) modules (ordered by order_index)
  │             ├──── (*) lessons (ordered by order_index)
  │             │             └──── (0..1) quiz [quiz_type = LESSON]
  │             └──── (1) quiz [quiz_type = MODULE]
  └──── (1) quiz [quiz_type = FINAL, linked via quizzes.course_id]
```
> The FINAL quiz is identified by `quizzes.quiz_type = 'FINAL'` and `quizzes.course_id`.
> There is NO `final_exam_id` column on `courses`.

### Enrollment & Progress
```
enrollments (1)
  ├──── (*) module_progress  ← PRIMARY SOURCE OF TRUTH
  │             └──── (*) lesson_progress
  └──── (0..1) certificates  ← issued only on full completion
```

### Module Unlock (Derived, Not Stored)
```
Module N is available IF:
  - N is the first module in the course, OR
  - module_progress for Module (N-1) has status = 'COMPLETED'
```
> Module availability is computed by FastAPI from `modules.order_index` and
> `module_progress.status`. No `is_unlocked` column exists.

### Assessment Audit
```
users (1) ──── (*) quiz_attempts (*) ──── (1) quizzes
                       │
                       └── (nullable) module_progress_id
                           (identifies which relearning cycle this attempt belongs to)
```

### AI Draft Workflow
```
lessons (1) ──── (*) ai_quiz_drafts
                       │
                       └── status: PENDING_REVIEW
                                     ├── → APPROVED  → instructor manually creates quiz/questions
                                     └── → DISCARDED → no further action
```

---

## C. Entity Field Definitions

---

### 1. `users`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK; references `auth.users(id)` ON DELETE CASCADE |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL |
| `full_name` | `VARCHAR(255)` | NOT NULL |
| `role` | `VARCHAR(20)` | ENUM(`ADMIN`, `INSTRUCTOR`, `USER`); Default: `USER` |
| `avatar_url` | `TEXT` | Nullable |
| `created_at` | `TIMESTAMPTZ` | Default: `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Default: `NOW()` |

---

### 2. `domains`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK; default `gen_random_uuid()` |
| `name` | `VARCHAR(100)` | UNIQUE, NOT NULL |
| `slug` | `VARCHAR(100)` | UNIQUE, NOT NULL |
| `description` | `TEXT` | Nullable |
| `icon_url` | `TEXT` | Nullable |
| `created_at` | `TIMESTAMPTZ` | Default: `NOW()` |

> **Examples:** Finance, Software & IT, Electronics, Business, Healthcare

---

### 3. `sub_domains`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK; default `gen_random_uuid()` |
| `domain_id` | `UUID` | FK → `domains(id)` ON DELETE RESTRICT, NOT NULL |
| `name` | `VARCHAR(150)` | NOT NULL |
| `slug` | `VARCHAR(150)` | UNIQUE, NOT NULL |
| `description` | `TEXT` | Nullable |
| `created_at` | `TIMESTAMPTZ` | Default: `NOW()` |

> **Examples (Finance):** Stock Market, Mutual Funds, Taxation  
> **Examples (Software & IT):** Machine Learning, Data Science, Cyber Security, IoT

---

### 4. `user_interests`
> Parent domain is **derived** through `sub_domains.domain_id`. Never stored on this table.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users(id)` ON DELETE CASCADE |
| `sub_domain_id` | `UUID` | FK → `sub_domains(id)` ON DELETE CASCADE |
| `created_at` | `TIMESTAMPTZ` | Default: `NOW()` |

> **Unique constraint:** `(user_id, sub_domain_id)`

---

### 5. `courses`
> Belongs to exactly one sub-domain. No `final_exam_id` column — the final quiz is identified via `quizzes.quiz_type = 'FINAL'` and `quizzes.course_id`.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `instructor_id` | `UUID` | FK → `users(id)` ON DELETE RESTRICT |
| `sub_domain_id` | `UUID` | FK → `sub_domains(id)` ON DELETE RESTRICT, NOT NULL |
| `title` | `VARCHAR(255)` | NOT NULL |
| `slug` | `VARCHAR(255)` | UNIQUE, NOT NULL |
| `description` | `TEXT` | NOT NULL |
| `thumbnail_url` | `TEXT` | Nullable |
| `difficulty_level` | `VARCHAR(20)` | ENUM(`BEGINNER`, `INTERMEDIATE`, `ADVANCED`) |
| `is_published` | `BOOLEAN` | Default: `false` |
| `created_at` | `TIMESTAMPTZ` | Default: `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Default: `NOW()` |

> **Domain derivation:** `courses.sub_domain_id → sub_domains.domain_id → domains`

---

### 6. `modules`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `course_id` | `UUID` | FK → `courses(id)` ON DELETE CASCADE, NOT NULL |
| `title` | `VARCHAR(255)` | NOT NULL |
| `description` | `TEXT` | Nullable |
| `order_index` | `INTEGER` | NOT NULL |
| `is_required` | `BOOLEAN` | Default: `true` |
| `created_at` | `TIMESTAMPTZ` | Default: `NOW()` |

> **Unique constraint:** `(course_id, order_index)`

---

### 7. `lessons`
> A lesson may contain any combination of text/markdown, video, and document content.
> The instructor decides what to provide. No combination is mandatory and no ratio is enforced.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `module_id` | `UUID` | FK → `modules(id)` ON DELETE CASCADE, NOT NULL |
| `title` | `VARCHAR(255)` | NOT NULL |
| `content_body` | `TEXT` | Nullable; freeform text / Markdown content |
| `video_url` | `TEXT` | Nullable; link to hosted video |
| `document_url` | `TEXT` | Nullable; link to Supabase Storage PDF or file |
| `duration_minutes` | `INTEGER` | Default: 0 |
| `order_index` | `INTEGER` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | Default: `NOW()` |

> **Unique constraint:** `(module_id, order_index)`  
> **Application-level rule (FastAPI):** At least one of `content_body`, `video_url`, or `document_url` must be provided when saving a lesson. This is enforced in the service layer, not at the DB level, to allow draft saving.

**Valid lesson content combinations:**

| Example | `content_body` | `video_url` | `document_url` |
|---------|:--------------:|:-----------:|:--------------:|
| Video only | NULL | ✓ | NULL |
| Document only | NULL | NULL | ✓ |
| Video + Document | NULL | ✓ | ✓ |
| Text + Video + Document | ✓ | ✓ | ✓ |
| Text only | ✓ | NULL | NULL |

---

### 8. `quizzes`
> `quiz_type` determines which FK is populated. The database enforces both exclusivity (exactly one target)
> and type-to-target alignment (type must match its populated FK) via CHECK constraints.
> The FINAL exam is always looked up via `quiz_type = 'FINAL'` AND `course_id = ?`.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `title` | `VARCHAR(255)` | NOT NULL |
| `description` | `TEXT` | Nullable |
| `quiz_type` | `VARCHAR(20)` | ENUM(`LESSON`, `MODULE`, `FINAL`), NOT NULL |
| `lesson_id` | `UUID` | Nullable; FK → `lessons(id)` ON DELETE CASCADE |
| `module_id` | `UUID` | Nullable; FK → `modules(id)` ON DELETE CASCADE |
| `course_id` | `UUID` | Nullable; FK → `courses(id)` ON DELETE CASCADE |
| `passing_score` | `NUMERIC(5,2)` | NOT NULL; CHECK BETWEEN 0.00 AND 100.00 |
| `max_attempts` | `INTEGER` | NOT NULL; Default: 3 |
| `time_limit_minutes` | `INTEGER` | Nullable (NULL = untimed) |
| `is_active` | `BOOLEAN` | Default: `true` |
| `created_at` | `TIMESTAMPTZ` | Default: `NOW()` |

**Default values by quiz type:**

| `quiz_type` | Default `passing_score` | Default `max_attempts` |
|-------------|:----------------------:|:----------------------:|
| `LESSON` | Instructor-defined | Instructor-defined |
| `MODULE` | 75.00 | 3 |
| `FINAL` | 70.00 | 3 |

**Check constraints (all three must hold simultaneously):**

```
CHECK 1 — Exactly one target:
  (lesson_id IS NOT NULL)::int
  + (module_id IS NOT NULL)::int
  + (course_id IS NOT NULL)::int = 1

CHECK 2 — Type-to-target alignment:
  (quiz_type = 'LESSON'  AND lesson_id  IS NOT NULL AND module_id IS NULL     AND course_id IS NULL)
  OR
  (quiz_type = 'MODULE'  AND module_id  IS NOT NULL AND lesson_id IS NULL     AND course_id IS NULL)
  OR
  (quiz_type = 'FINAL'   AND course_id  IS NOT NULL AND lesson_id IS NULL     AND module_id IS NULL)

CHECK 3 — Score range:
  passing_score BETWEEN 0.00 AND 100.00
```

> These two CHECK constraints together make CHECK 1 redundant but it is kept for clarity.

---

### 9. `questions`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `quiz_id` | `UUID` | FK → `quizzes(id)` ON DELETE CASCADE |
| `question_text` | `TEXT` | NOT NULL |
| `question_type` | `VARCHAR(20)` | ENUM(`MCQ`, `MULTI_SELECT`, `TRUE_FALSE`); Default: `MCQ` |
| `explanation` | `TEXT` | Nullable (shown post-submission) |
| `points` | `INTEGER` | Default: 1 |
| `order_index` | `INTEGER` | NOT NULL |

> **Unique constraint:** `(quiz_id, order_index)`

---

### 10. `question_options`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `question_id` | `UUID` | FK → `questions(id)` ON DELETE CASCADE |
| `option_text` | `TEXT` | NOT NULL |
| `is_correct` | `BOOLEAN` | NOT NULL; Default: `false` |
| `order_index` | `INTEGER` | NOT NULL |

> **Unique constraint:** `(question_id, order_index)`

---

### 11. `ai_quiz_drafts`
> AI output is quarantined here. It **never** writes directly to `quizzes` or `questions`.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `lesson_id` | `UUID` | FK → `lessons(id)` ON DELETE CASCADE |
| `instructor_id` | `UUID` | FK → `users(id)` ON DELETE SET NULL |
| `prompt_context` | `TEXT` | Snapshot of lesson content used as prompt input |
| `raw_llm_response` | `JSONB` | Full validated structured output from LLM |
| `status` | `VARCHAR(25)` | ENUM(`PENDING_REVIEW`, `APPROVED`, `DISCARDED`); Default: `PENDING_REVIEW` |
| `created_at` | `TIMESTAMPTZ` | Default: `NOW()` |
| `reviewed_at` | `TIMESTAMPTZ` | Nullable; set on approval or discard |

---

### 12. `enrollments`
> No `derived_progress_pct` column. Course progress is always computed dynamically from `module_progress` at query time.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users(id)` ON DELETE CASCADE |
| `course_id` | `UUID` | FK → `courses(id)` ON DELETE CASCADE |
| `status` | `VARCHAR(20)` | ENUM(`ACTIVE`, `COMPLETED`, `DROPPED`); Default: `ACTIVE` |
| `enrolled_at` | `TIMESTAMPTZ` | Default: `NOW()` |
| `completed_at` | `TIMESTAMPTZ` | Nullable |

> **Unique constraint:** `(user_id, course_id)`

---

### 13. `module_progress`
> **Primary source of truth** for progress state. No `is_unlocked` column — availability is derived from curriculum order.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `enrollment_id` | `UUID` | FK → `enrollments(id)` ON DELETE CASCADE |
| `module_id` | `UUID` | FK → `modules(id)` ON DELETE CASCADE |
| `status` | `VARCHAR(25)` | ENUM(`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `NEEDS_RELEARNING`); Default: `NOT_STARTED` |
| `attempts_used` | `INTEGER` | Default: 0 |
| `started_at` | `TIMESTAMPTZ` | Nullable |
| `completed_at` | `TIMESTAMPTZ` | Nullable |
| `relearning_triggered_at` | `TIMESTAMPTZ` | Nullable |

> **Unique constraint:** `(enrollment_id, module_id)`

---

### 14. `lesson_progress`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `module_progress_id` | `UUID` | FK → `module_progress(id)` ON DELETE CASCADE |
| `lesson_id` | `UUID` | FK → `lessons(id)` ON DELETE CASCADE |
| `is_completed` | `BOOLEAN` | Default: `false` |
| `completed_at` | `TIMESTAMPTZ` | Nullable |

> **Unique constraint:** `(module_progress_id, lesson_id)`

---

### 15. `quiz_attempts`
> **Append-only. Never updated. Never deleted.**  
> `attempt_number` increments globally per `(user_id, quiz_id)` across all relearning cycles.  
> `attempt_cycle` increments each time a new relearning cycle begins, allowing per-cycle history grouping.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users(id)` ON DELETE CASCADE |
| `quiz_id` | `UUID` | FK → `quizzes(id)` ON DELETE RESTRICT |
| `module_progress_id` | `UUID` | Nullable; FK → `module_progress(id)` ON DELETE SET NULL |
| `attempt_number` | `INTEGER` | NOT NULL; sequential per `(user_id, quiz_id)` |
| `attempt_cycle` | `INTEGER` | NOT NULL; Default: 1; increments on each new relearning cycle |
| `score_achieved` | `NUMERIC(5,2)` | NOT NULL; CHECK BETWEEN 0.00 AND 100.00 |
| `is_passed` | `BOOLEAN` | NOT NULL |
| `submitted_answers` | `JSONB` | NOT NULL; snapshot of `{question_id, selected_option_ids, is_correct}` per question |
| `started_at` | `TIMESTAMPTZ` | Default: `NOW()` |
| `submitted_at` | `TIMESTAMPTZ` | Default: `NOW()` |

> **`attempt_cycle` usage example:** A learner fails 3 times (cycle 1, attempts 1–3) → relearning → passes on attempt 4 (cycle 2, attempt 4). The full history is preserved and each cycle is distinguishable.

---

### 16. `certificates`
> Issued only after all required modules are `COMPLETED` AND the final exam is passed.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` | PK |
| `enrollment_id` | `UUID` | UNIQUE; FK → `enrollments(id)` ON DELETE CASCADE |
| `user_id` | `UUID` | FK → `users(id)` ON DELETE CASCADE |
| `course_id` | `UUID` | FK → `courses(id)` ON DELETE CASCADE |
| `certificate_number` | `VARCHAR(100)` | UNIQUE, NOT NULL (e.g., `DC-2026-ABCD-1234`) |
| `issued_at` | `TIMESTAMPTZ` | Default: `NOW()` |
| `pdf_storage_path` | `TEXT` | Path in Supabase Storage `certificates` bucket |
| `verification_hash` | `VARCHAR(64)` | UNIQUE; SHA-256 of `(user_id + course_id + issued_at)` |

---

## D. Constraints & Indexes

### Unique Constraints

| Table | Unique On |
|-------|-----------|
| `domains` | `name`, `slug` |
| `sub_domains` | `slug` |
| `user_interests` | `(user_id, sub_domain_id)` |
| `courses` | `slug` |
| `modules` | `(course_id, order_index)` |
| `lessons` | `(module_id, order_index)` |
| `questions` | `(quiz_id, order_index)` |
| `question_options` | `(question_id, order_index)` |
| `enrollments` | `(user_id, course_id)` |
| `module_progress` | `(enrollment_id, module_id)` |
| `lesson_progress` | `(module_progress_id, lesson_id)` |
| `quiz_attempts` | `(user_id, quiz_id, attempt_number)` |
| `certificates` | `enrollment_id`, `certificate_number`, `verification_hash` |

### Check Constraints

| Table | Constraint |
|-------|------------|
| `quizzes` | Type-to-target alignment (see entity definition above for full 3-part CHECK) |
| `quizzes` | `passing_score BETWEEN 0.00 AND 100.00` |
| `quiz_attempts` | `score_achieved BETWEEN 0.00 AND 100.00` |

### Quiz Cardinality — Partial Unique Indexes
> These enforce the one-quiz-per-target rule at the database level without imposing
> a full unique constraint across unrelated rows.

| Index | Definition | Enforces |
|-------|------------|----------|
| `uq_quiz_per_lesson` | `UNIQUE (lesson_id) WHERE quiz_type = 'LESSON'` | Max 1 LESSON quiz per lesson |
| `uq_quiz_per_module` | `UNIQUE (module_id) WHERE quiz_type = 'MODULE'` | Max 1 MODULE quiz per module |
| `uq_quiz_per_course_final` | `UNIQUE (course_id) WHERE quiz_type = 'FINAL'` | Max 1 FINAL quiz per course |

### Performance Indexes

| Index Name | Table & Column(s) | Purpose |
|------------|-------------------|---------|
| `idx_sub_domains_domain` | `sub_domains(domain_id)` | Domain → Sub-Domain lookups |
| `idx_courses_sub_domain` | `courses(sub_domain_id)` WHERE `is_published = true` | Discovery queries |
| `idx_user_interests_user` | `user_interests(user_id)` | Personalized discovery |
| `idx_modules_course_order` | `modules(course_id, order_index)` | Curriculum rendering |
| `idx_lessons_module_order` | `lessons(module_id, order_index)` | Lesson sequencing |
| `idx_module_progress_enrollment` | `module_progress(enrollment_id, status)` | Progress calculations |
| `idx_quiz_attempts_user_quiz` | `quiz_attempts(user_id, quiz_id)` | Attempt count lookups |
| `idx_certificates_hash` | `certificates(verification_hash)` | Certificate verification |

---

### Cross-Entity Ownership Validation
> These rules are **enforced by the FastAPI service layer**, not by database foreign keys.
> No composite FKs or database triggers are introduced for this in the MVP.

**`module_progress` ownership:**
```
Before creating/updating a module_progress record, FastAPI must verify:
  modules.course_id == enrollments.course_id
  (i.e., the module belongs to the same course the user is enrolled in)
```

**`lesson_progress` ownership:**
```
Before creating/updating a lesson_progress record, FastAPI must verify:
  lessons.module_id == module_progress.module_id
  (i.e., the lesson belongs to the module tracked by the module_progress record)
```

Both validations are performed within a single service transaction before any write occurs.
A mismatch returns `HTTP 400 Bad Request` with a descriptive error.

---

## E. Business Logic & Derived Rules

---

### Progress Calculation (Dynamic — Never Stored)

```
course_progress_pct =
  COUNT(module_progress WHERE status = 'COMPLETED' AND modules.is_required = true)
  ÷
  COUNT(modules WHERE course_id = ? AND is_required = true)
  × 100
```
Computed in FastAPI each time it is needed. Never persisted to any column.

---

### Module Availability (Derived from Order)

```
Module at order_index N is available to the user IF:
  N = 1 (first module in course)
  OR
  module_progress.status = 'COMPLETED'
    for the module with order_index = N - 1
    within the same enrollment
```
No column stores this. FastAPI evaluates it on every lesson/module access.

---

### Final Exam Unlock

```
FINAL quiz is accessible IF:
  course_progress_pct >= 80
```
If not met, FastAPI returns `HTTP 403` with the list of incomplete required modules.

---

### Course Completion

```
Course is COMPLETED IF:
  ALL required module_progress records have status = 'COMPLETED'
  AND
  A quiz_attempt for the FINAL quiz (quiz_type='FINAL', course_id=?) exists
    WHERE is_passed = true

THEN:
  enrollments.status = 'COMPLETED'
  enrollments.completed_at = NOW()
  → /certificates/claim endpoint is unlocked
```

---

### Relearning Lifecycle (Corrected)

```
FAILURE EVENT (all attempts exhausted, never passed):
  IF attempts_used >= quizzes.max_attempts AND is_passed = false:
    module_progress.status          → NEEDS_RELEARNING
    module_progress.relearning_triggered_at → NOW()
    lesson_progress.is_completed    → false  (all lessons in this module reset)
    quiz_attempts                   → UNTOUCHED (immutable history preserved)
    module_progress.attempts_used   → unchanged at this point (still at max)

RE-ENGAGEMENT (user re-reads all lessons):
  User works through and completes all lessons again
  (lesson_progress.is_completed = true for each lesson)

NEW CYCLE START (all lessons re-completed):
  module_progress.status     → IN_PROGRESS
  module_progress.attempts_used → 0   ← reset happens HERE, not at failure
  User may now re-attempt the module quiz

ATTEMPT:
  Each new submission appends a new row to quiz_attempts
  attempt_number continues from last global value (e.g., if 3 prior attempts, next is 4)
```

---

### AI Draft Promotion Workflow

```
1. Instructor triggers AI generation for a lesson
2. FastAPI calls LLM → validates against AIDraftQuizResponse Pydantic schema
3. Validated output inserted into ai_quiz_drafts (status = PENDING_REVIEW)
   ← AI touches ONLY this table. Never quizzes or questions.
4. Instructor reviews draft in UI → edits question text / options / correct answer
5. Instructor clicks APPROVE:
   FastAPI reads ai_quiz_drafts.raw_llm_response (with any edits applied)
   → creates quiz row (quiz_type = LESSON, lesson_id = ?)
   → creates question rows
   → creates question_option rows
   → updates ai_quiz_drafts.status = APPROVED, reviewed_at = NOW()
6. OR: Instructor clicks DISCARD → status = DISCARDED, reviewed_at = NOW()
```

---

### Personalized Discovery Query Path

```
user → user_interests.sub_domain_id
     → courses WHERE sub_domain_id IN (user's sub_domain_ids)
                AND is_published = true

Parent domain label (for UI grouping):
  user_interests.sub_domain_id → sub_domains.domain_id → domains.name
```

---

## F. All Approved Decisions

| Decision | Value |
|----------|-------|
| Auth Provider | Supabase Auth |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (`certificates`, `course-assets` buckets) |
| Backend | FastAPI (Python) — modular monolith + SQLAlchemy |
| Frontend | React + TypeScript (Vite) |
| Roles | `ADMIN`, `INSTRUCTOR`, `USER` |
| Taxonomy | Domain → Sub-Domain → Course (hierarchical, no flat categories) |
| Course sub-domain relationship | Many-to-one (a course belongs to exactly one sub-domain) |
| Lesson content model | Flexible: `content_body` + `video_url` + `document_url` all nullable; any combination valid |
| No fixed content ratio | No 60/40 or any other ratio enforced in DB or application |
| Progress source of truth | `module_progress` (always dynamic, never cached) |
| `courses.final_exam_id` | **Does not exist** |
| `enrollments.derived_progress_pct` | **Does not exist** |
| `module_progress.is_unlocked` | **Does not exist** |
| Module availability | Derived from `order_index` + previous module `COMPLETED` status |
| Quiz types | `LESSON`, `MODULE`, `FINAL` |
| Quiz type-to-target integrity | Enforced by DB CHECK constraint (type must match its FK) |
| Quiz cardinality | Max 1 quiz per lesson, per module, per course (partial unique indexes) |
| Final quiz identification | `quizzes.quiz_type = 'FINAL'` AND `quizzes.course_id = ?` (no FK on courses table) |
| MODULE quiz defaults | `passing_score = 75.00`, `max_attempts = 3` |
| FINAL quiz defaults | `passing_score = 70.00`, `max_attempts = 3` |
| Quiz attempts | Append-only; `attempt_number` globally sequential per `(user_id, quiz_id)` |
| `attempt_cycle` | Stored on `quiz_attempts`; increments on each new relearning cycle |
| Relearning trigger | On max attempts exhausted with no passing attempt |
| `attempts_used` reset timing | At start of new relearning cycle (all lessons re-completed), **not** at failure event |
| Cross-entity ownership | Enforced by FastAPI service layer (module belongs to enrolled course; lesson belongs to tracked module) |
| Final exam unlock threshold | `course_progress_pct >= 80` (dynamic calculation) |
| Certificate trigger | All required modules `COMPLETED` + final exam passed |
| AI quarantine | AI writes only to `ai_quiz_drafts`; instructor manually promotes to production tables |
| LLM provider | Single provider initially; abstracted behind `BaseLLMProvider` interface for future swap |
| AI recommendations | **Excluded from MVP** — discovery uses interest → sub-domain → course matching |
| Stretch features excluded from schema | SSO, proctoring, email notifications, public cert verification, exam mode |
