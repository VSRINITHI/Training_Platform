// User and Auth Types
export type UserRole = 'USER' | 'INSTRUCTOR' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface UserUpdatePayload {
  full_name?: string;
  avatar_url?: string | null;
  role?: UserRole;
}

// Taxonomy Types
export interface Domain {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon_url?: string | null;
  created_at: string;
  sub_domains?: SubDomain[];
}

export interface SubDomain {
  id: string;
  domain_id: string;
  name: string;
  slug: string;
  description?: string | null;
  created_at: string;
  domain?: Domain;
  published_course_count?: number;
}

export interface DomainCreatePayload {
  name: string;
  slug: string;
  description?: string | null;
  icon_url?: string | null;
}

export interface DomainUpdatePayload {
  name?: string;
  slug?: string;
  description?: string | null;
  icon_url?: string | null;
}

export interface SubDomainCreatePayload {
  domain_id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface SubDomainUpdatePayload {
  name?: string;
  slug?: string;
  description?: string | null;
}

export interface UserInterest {
  id: string;
  user_id: string;
  sub_domain_id: string;
  created_at: string;
  sub_domain?: SubDomain;
}

// Course and Curriculum Types
export type DifficultyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface Course {
  id: string;
  instructor_id: string;
  sub_domain_id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url?: string | null;
  difficulty_level?: DifficultyLevel | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  instructor?: UserProfile;
  sub_domain?: SubDomain;
  modules?: ModuleDetail[];
}

export interface PersonalizedDiscoveryResponse {
  is_personalized: boolean;
  interest_sub_domain_ids: string[];
  matched_courses: Course[];
  total_matches: number;
}

export interface CourseCreatePayload {
  sub_domain_id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url?: string | null;
  difficulty_level?: DifficultyLevel | null;
  is_published?: boolean;
}

export interface CourseUpdatePayload {
  title?: string;
  slug?: string;
  description?: string;
  thumbnail_url?: string | null;
  difficulty_level?: DifficultyLevel | null;
  sub_domain_id?: string;
  is_published?: boolean;
}

export interface ModuleItem {
  id: string;
  course_id: string;
  title: string;
  description?: string | null;
  order_index: number;
  is_required: boolean;
  created_at: string;
}

export interface ModuleDetail extends ModuleItem {
  lessons: LessonItem[];
}

export interface ModuleCreatePayload {
  title: string;
  description?: string | null;
  order_index?: number;
  is_required?: boolean;
}

export interface ModuleUpdatePayload {
  title?: string;
  description?: string | null;
  order_index?: number;
  is_required?: boolean;
}

export interface LessonItem {
  id: string;
  module_id: string;
  title: string;
  duration_minutes?: number | null;
  order_index: number;
  content_body?: string | null;
  video_url?: string | null;
  document_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonCreatePayload {
  title: string;
  duration_minutes?: number | null;
  order_index?: number;
  content_body?: string | null;
  video_url?: string | null;
  document_url?: string | null;
}

export interface LessonUpdatePayload {
  title?: string;
  duration_minutes?: number | null;
  order_index?: number;
  content_body?: string | null;
  video_url?: string | null;
  document_url?: string | null;
}

export interface ReorderPayload {
  items: { id: string; order_index: number }[];
}

// Quiz & Question Types
export type QuizType = 'LESSON' | 'MODULE' | 'FINAL';
export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'MULTI_SELECT';
export type AIDraftStatus = 'PENDING_REVIEW' | 'APPROVED' | 'DISCARDED';

export interface QuestionOptionPublic {
  id: string;
  question_id: string;
  option_text: string;
  order_index: number;
}

export interface QuestionOptionAuthoring extends QuestionOptionPublic {
  is_correct: boolean;
}

export interface QuestionPublic {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: QuestionType;
  points: number;
  order_index: number;
  options: QuestionOptionPublic[];
}

export interface QuestionAuthoring {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: QuestionType;
  explanation?: string | null;
  points: number;
  order_index: number;
  options: QuestionOptionAuthoring[];
}

export interface QuizPublic {
  id: string;
  title: string;
  description?: string | null;
  quiz_type: QuizType;
  passing_score: number;
  max_attempts: number;
  time_limit_minutes?: number | null;
  questions: QuestionPublic[];
}

export interface QuizAuthoring {
  id: string;
  title: string;
  description?: string | null;
  quiz_type: QuizType;
  lesson_id?: string | null;
  module_id?: string | null;
  course_id?: string | null;
  passing_score: number;
  max_attempts: number;
  time_limit_minutes?: number | null;
  is_active: boolean;
  created_at: string;
  questions: QuestionAuthoring[];
}

export interface QuizCreatePayload {
  title: string;
  description?: string | null;
  quiz_type: QuizType;
  lesson_id?: string | null;
  module_id?: string | null;
  course_id?: string | null;
  passing_score: number;
  max_attempts?: number;
  time_limit_minutes?: number | null;
  is_active?: boolean;
}

export interface QuizUpdatePayload {
  title?: string;
  description?: string | null;
  passing_score?: number;
  max_attempts?: number;
  time_limit_minutes?: number | null;
  is_active?: boolean;
}

export interface QuestionCreatePayload {
  question_text: string;
  question_type: QuestionType;
  explanation?: string | null;
  points?: number;
  order_index?: number;
  options?: {
    option_text: string;
    is_correct: boolean;
    order_index?: number;
  }[];
}

export interface QuestionUpdatePayload {
  question_text?: string;
  question_type?: QuestionType;
  explanation?: string | null;
  points?: number;
  order_index?: number;
}

export interface QuestionOptionCreatePayload {
  option_text: string;
  is_correct: boolean;
  order_index?: number;
}

export interface QuestionOptionUpdatePayload {
  option_text?: string;
  is_correct?: boolean;
  order_index?: number;
}

// AI Draft Types
export interface AIQuizDraft {
  id: string;
  lesson_id: string;
  instructor_id?: string | null;
  prompt_context?: string | null;
  raw_llm_response: any;
  status: AIDraftStatus;
  created_at: string;
  reviewed_at?: string | null;
}

export interface AIQuizDraftCreatePayload {
  lesson_id: string;
  prompt_context?: string | null;
  raw_llm_response: any;
}

export interface AIQuizDraftReviewPayload {
  status: 'APPROVED' | 'DISCARDED';
  import_to_quiz?: boolean;
}

// Enrollment & Progress Types
export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type ModuleProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_RELEARNING';

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at?: string | null;
  course?: Course;
}

export interface LessonProgressRecord {
  id: string;
  module_progress_id: string;
  lesson_id: string;
  is_completed: boolean;
  completed_at?: string | null;
}

export interface ModuleProgressDetail {
  id: string;
  enrollment_id: string;
  module_id: string;
  module_title: string;
  order_index: number;
  is_required: boolean;
  is_unlocked: boolean;
  status: ModuleProgressStatus;
  attempts_used: number;
  started_at?: string | null;
  completed_at?: string | null;
  relearning_triggered_at?: string | null;
  total_lessons_count: number;
  completed_lessons_count: number;
  lesson_progress_records: LessonProgressRecord[];
}

export interface CourseProgressHierarchy {
  enrollment_id: string;
  course_id: string;
  status: EnrollmentStatus;
  total_required_modules: number;
  completed_required_modules: number;
  progress_pct: number;
  is_final_exam_unlocked: boolean;
  is_course_completed: boolean;
  modules: ModuleProgressDetail[];
}

// Quiz Submission & Result Types
export interface QuizAnswerSubmission {
  question_id: string;
  selected_option_ids: string[];
}

export interface QuizSubmissionPayload {
  answers: QuizAnswerSubmission[];
}

export interface QuestionResult {
  question_id: string;
  is_correct: boolean;
  points_awarded: number;
  max_points: number;
  explanation?: string | null;
  selected_option_ids: string[];
  correct_option_ids: string[];
}

export interface QuizSubmissionResult {
  attempt_id: string;
  quiz_id: string;
  attempt_number: number;
  attempt_cycle: number;
  score_achieved: number;
  passing_score: number;
  is_passed: boolean;
  relearning_triggered: boolean;
  question_results: QuestionResult[];
}

export interface QuizAttemptRecord {
  id: string;
  user_id: string;
  quiz_id: string;
  module_progress_id?: string | null;
  attempt_number: number;
  attempt_cycle: number;
  score_achieved: number;
  is_passed: boolean;
  submitted_at: string;
  submitted_answers?: any;
}

// Certificate Types
export interface Certificate {
  id: string;
  enrollment_id: string;
  user_id: string;
  course_id: string;
  certificate_number: string;
  issued_at: string;
  verification_hash: string;
  course?: Course;
}

export interface CertificateVerifyResult {
  is_valid: boolean;
  certificate_number?: string | null;
  student_name?: string | null;
  course_title?: string | null;
  issued_at?: string | null;
  verification_hash?: string | null;
}
