import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Eye, CheckCircle2, XCircle, Clock, AlertTriangle, BookOpen } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';

export const AIDraftsPage: React.FC = () => {
  // Fetch instructor's courses to discover lessons
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['instructor-courses-ai-drafts'],
    queryFn: () => coursesApi.list(),
  });

  if (isLoading) {
    return <LoadingState message="Loading AI quarantine queue..." className="py-24" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Draft Quarantine & Review Queue"
        description="Inspect, review, and import AI-generated quiz questions into live course curriculums."
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-primary border border-indigo-200 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Human-in-the-Loop Review
          </span>
        }
      />

      <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-xs text-charcoal-muted flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p>
          AI-generated question drafts remain quarantined in <strong className="text-charcoal">PENDING_REVIEW</strong> status. They will never be shown to learners until you explicitly approve and import them into a lesson quiz.
        </p>
      </div>

      {/* Course & Lesson Draft Navigator */}
      <div className="space-y-4">
        {courses.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="w-10 h-10 text-primary" />}
            title="No Courses Found"
            description="Create a course and lessons first to generate and review AI quiz drafts."
            actionLabel="Create Course"
            onAction={() => window.location.assign('/instructor/courses/new')}
          />
        ) : (
          <div className="space-y-4">
            {courses.map((course) => (
              <div key={course.id} className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div>
                    <h3 className="text-base font-bold text-charcoal">{course.title}</h3>
                    <p className="text-xs text-charcoal-muted">{course.sub_domain?.name}</p>
                  </div>
                  <Link to={`/instructor/courses/${course.id}/curriculum`}>
                    <Button size="sm" variant="outline">
                      Curriculum
                    </Button>
                  </Link>
                </div>

                <div className="space-y-2 pt-1">
                  {course.modules && course.modules.length > 0 ? (
                    course.modules.map((mod) => (
                      <div key={mod.id} className="pl-2 space-y-1.5">
                        <span className="text-xs font-semibold text-charcoal">{mod.title}</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                          {mod.lessons?.map((les) => (
                            <div
                              key={les.id}
                              className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs"
                            >
                              <span className="font-medium text-charcoal truncate max-w-[180px]">
                                {les.title}
                              </span>
                              <Link to={`/instructor/lessons/${les.id}/ai-generate`}>
                                <Button size="sm" variant="outline" leftIcon={<Sparkles className="w-3 h-3 text-primary" />}>
                                  Generate Draft
                                </Button>
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-charcoal-muted italic">No modules in this course.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
