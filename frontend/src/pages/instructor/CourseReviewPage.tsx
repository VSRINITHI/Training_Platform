import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Award,
  Globe,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';

export const CourseReviewPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const { data: course, isLoading } = useQuery({
    queryKey: ['course-review-checklist', courseId],
    queryFn: () => coursesApi.get(courseId!),
    enabled: Boolean(courseId),
  });

  const publishMutation = useMutation({
    mutationFn: () => coursesApi.publish(courseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-review-checklist', courseId] });
      queryClient.invalidateQueries({ queryKey: ['instructor-courses-list'] });
      success('Course Published! 🚀', 'Your course is now visible to all learners in the catalog.');
      navigate('/instructor/courses');
    },
    onError: (err: any) => {
      toastError('Publish Failed', err.message);
    },
  });

  if (isLoading) {
    return <LoadingState message="Checking course readiness..." className="py-24" />;
  }

  if (!course) return null;

  const modules = course.modules || [];
  const hasModules = modules.length > 0;
  const hasLessons = modules.some((m) => m.lessons && m.lessons.length > 0);
  const isReady = hasModules && hasLessons;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-xs text-charcoal-muted mb-2">
        <Link to={`/instructor/courses/${courseId}/curriculum`} className="hover:text-charcoal hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Curriculum
        </Link>
      </div>

      <PageHeader
        title={`Course Review: ${course.title}`}
        description="Verify curriculum checklist before publishing to learners."
        badge={
          course.is_published ? (
            <Badge variant="success">Published</Badge>
          ) : (
            <Badge variant="warning">Draft</Badge>
          )
        }
      />

      {/* Checklist Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-6">
        <h3 className="text-base font-bold text-charcoal">Publication Readiness Checklist</h3>

        <div className="space-y-4">
          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-charcoal">Course Metadata & Topic Defined</p>
              <p className="text-xs text-charcoal-muted mt-0.5">
                Topic: {course.sub_domain?.name || 'General'} • Difficulty: {course.difficulty_level || 'Beginner'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            {hasModules ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-semibold text-charcoal">Curriculum Chapters Created</p>
              <p className="text-xs text-charcoal-muted mt-0.5">
                {modules.length} module chapter{modules.length !== 1 ? 's' : ''} defined.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            {hasLessons ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-semibold text-charcoal">Lessons with Study Material</p>
              <p className="text-xs text-charcoal-muted mt-0.5">
                Sequential lessons present across curriculum chapters.
              </p>
            </div>
          </div>
        </div>

        {/* Publish Action CTA */}
        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to={`/instructor/courses/${courseId}/curriculum`}>
            <Button variant="outline" size="md">
              Edit Curriculum
            </Button>
          </Link>

          {!course.is_published ? (
            <Button
              size="md"
              variant="primary"
              disabled={!isReady}
              isLoading={publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
              leftIcon={<Globe className="w-4 h-4" />}
            >
              Publish Course to Catalog
            </Button>
          ) : (
            <span className="text-xs font-semibold text-emerald-600">
              ✓ This course is live in the public catalog.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
