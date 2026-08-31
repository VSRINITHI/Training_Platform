import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  User,
  Clock,
  Award,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { progressApi } from '../../api/progress';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';

export const CourseDetailsPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // 1. Fetch Course details (with modules & lessons)
  const {
    data: course,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: () => coursesApi.get(courseId!),
    enabled: Boolean(courseId),
  });

  // 2. Fetch User's enrollments
  const { data: enrollments = [] } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: progressApi.getMyEnrollments,
  });

  const currentEnrollment = enrollments.find((e) => e.course_id === courseId);
  const isEnrolled = Boolean(currentEnrollment && currentEnrollment.status === 'ACTIVE');

  // 3. Enroll Mutation
  const enrollMutation = useMutation({
    mutationFn: () => progressApi.enroll(courseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      success('Enrolled Successfully', 'Welcome to the course! Redirecting to your workspace.');
      navigate(`/learner/learning/${courseId}`);
    },
    onError: (err: any) => {
      toastError('Enrollment Failed', err.message);
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading course curriculum..." className="py-24" />;
  }

  if (isError || !course) {
    return (
      <ErrorState
        title="Course Not Found"
        message="We couldn't retrieve this course. It may not be published or does not exist."
        onRetry={refetch}
      />
    );
  }

  const modules = course.modules || [];
  const totalLessons = modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);

  return (
    <div className="space-y-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-charcoal-muted">
        <Link to="/learner/discover" className="hover:text-charcoal hover:underline">
          Courses
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        {course.sub_domain && (
          <>
            <span className="hover:text-charcoal">{course.sub_domain.name}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </>
        )}
        <span className="font-semibold text-charcoal truncate">{course.title}</span>
      </div>

      {/* Hero Course Header Card */}
      <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-card grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {course.sub_domain && <Badge variant="primary">{course.sub_domain.name}</Badge>}
            {course.difficulty_level && <Badge variant="outline">{course.difficulty_level}</Badge>}
            <Badge variant="success">Competency Verified</Badge>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-charcoal tracking-tight">
            {course.title}
          </h1>

          <p className="text-sm text-charcoal-muted leading-relaxed">
            {course.description}
          </p>

          <div className="flex items-center gap-6 pt-4 border-t border-border/60 text-xs text-charcoal-muted flex-wrap">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" />
              <span>Instructor: <strong className="text-charcoal">{course.instructor?.full_name || 'Academic Lead'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>{modules.length} Modules ({totalLessons} Lessons)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-primary" />
              <span>Verified Certificate</span>
            </div>
          </div>
        </div>

        {/* Action / Enrollment Box */}
        <div className="bg-slate-50 rounded-xl p-6 border border-border flex flex-col justify-between space-y-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
              Enrollment Status
            </span>
            <div className="text-2xl font-bold text-charcoal mt-1">
              {isEnrolled ? 'Currently Enrolled' : 'Free Access'}
            </div>
            <p className="text-xs text-charcoal-muted mt-1.5 leading-relaxed">
              {isEnrolled
                ? 'You are enrolled in this track. Jump right into your active learning workspace.'
                : 'Enroll to access interactive lessons, module quizzes, and certification exams.'}
            </p>
          </div>

          <div className="space-y-3">
            {isEnrolled ? (
              <Link to={`/learner/learning/${course.id}`} className="block">
                <Button size="lg" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Continue Learning
                </Button>
              </Link>
            ) : (
              <Button
                size="lg"
                className="w-full"
                isLoading={enrollMutation.isPending}
                onClick={() => enrollMutation.mutate()}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Enroll Now
              </Button>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-charcoal-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Includes final assessment and certificate verification</span>
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum Syllabus Tree */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-charcoal">Curriculum Syllabus</h2>
          <p className="text-xs text-charcoal-muted">Structured sequential modules and learning checkpoints</p>
        </div>

        {modules.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-border text-center text-xs text-charcoal-muted">
            Curriculum content is currently being finalized by the instructor.
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((module, mIdx) => (
              <div key={module.id} className="bg-white rounded-xl border border-border p-5 shadow-card space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary-light text-primary font-bold text-xs">
                      {mIdx + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-charcoal">{module.title}</h3>
                      {module.description && (
                        <p className="text-xs text-charcoal-muted mt-0.5">{module.description}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-charcoal-muted font-medium">
                    {module.lessons?.length || 0} Lessons
                  </span>
                </div>

                {/* Lessons List in Module */}
                {module.lessons && module.lessons.length > 0 && (
                  <div className="pl-10 space-y-2 pt-2 border-t border-border/60">
                    {module.lessons.map((lesson, lIdx) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between text-xs py-1.5 text-charcoal-muted hover:text-charcoal"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {lIdx + 1}. {lesson.title}
                          </span>
                        </div>
                        {lesson.duration_minutes && (
                          <span className="text-[11px] text-slate-400">{lesson.duration_minutes} min</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
