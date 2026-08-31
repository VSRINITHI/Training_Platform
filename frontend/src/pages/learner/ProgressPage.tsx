import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { progressApi } from '../../api/progress';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

export const ProgressPage: React.FC = () => {
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: progressApi.getMyEnrollments,
  });

  const activeEnrollments = enrollments.filter((e) => e.status === 'ACTIVE');
  const completedEnrollments = enrollments.filter((e) => e.status === 'COMPLETED');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Learning Progress" description="Track your enrolled courses, lesson milestones, and certificate achievements." />
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Learning Progress"
        description="Track your enrolled courses, module completions, and graduation eligibility."
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-light text-primary">
            {enrollments.length} Total Enrolled
          </span>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-border shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-charcoal-muted">Active Courses</span>
            <p className="text-2xl font-bold text-charcoal mt-1">{activeEnrollments.length}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-primary rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-charcoal-muted">Completed Courses</span>
            <p className="text-2xl font-bold text-charcoal mt-1">{completedEnrollments.length}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-charcoal-muted">Certificates Earned</span>
            <p className="text-2xl font-bold text-charcoal mt-1">{completedEnrollments.length}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Active Enrollments List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-charcoal">Active Course Workspaces</h2>

        {activeEnrollments.length === 0 ? (
          <EmptyState
            title="No Active Courses"
            description="You are not currently enrolled in any active course tracks."
            actionLabel="Discover Courses"
            onAction={() => window.location.assign('/learner/discover')}
          />
        ) : (
          <div className="space-y-4">
            {activeEnrollments.map((enr) => (
              <div
                key={enr.id}
                className="bg-white p-6 rounded-2xl border border-border shadow-card hover:shadow-card-hover transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary" size="sm">
                      Enrolled
                    </Badge>
                    {enr.course?.difficulty_level && (
                      <Badge variant="outline" size="sm">
                        {enr.course.difficulty_level}
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-charcoal">{enr.course?.title}</h3>
                  <p className="text-xs text-charcoal-muted line-clamp-2 leading-relaxed">
                    {enr.course?.description}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-charcoal-muted pt-1">
                    <span>Enrolled: {new Date(enr.enrolled_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                  <Link to={`/learner/learning/${enr.course_id}`} className="w-full sm:w-auto">
                    <Button size="md" className="w-full sm:w-auto" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Open Workspace
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Courses */}
      {completedEnrollments.length > 0 && (
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-bold text-charcoal">Completed Courses & Certificates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedEnrollments.map((enr) => (
              <div
                key={enr.id}
                className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-card flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="success" size="sm">
                      Completed
                    </Badge>
                    <Award className="w-5 h-5 text-amber-500" />
                  </div>
                  <h3 className="text-base font-bold text-charcoal pt-1">{enr.course?.title}</h3>
                  <p className="text-xs text-charcoal-muted">
                    Graduated on {enr.completed_at ? new Date(enr.completed_at).toLocaleDateString() : 'recently'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <Link
                    to="/learner/certificates"
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>View Certificate</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
