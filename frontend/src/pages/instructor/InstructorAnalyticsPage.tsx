import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, BookOpen, Users, Award, Clock } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';

export const InstructorAnalyticsPage: React.FC = () => {
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['instructor-analytics-courses'],
    queryFn: () => coursesApi.list(),
  });

  const totalCourses = courses.length;
  const publishedCount = courses.filter((c) => c.is_published).length;
  const draftCount = totalCourses - publishedCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instructor Analytics"
        description="Course publication overview and curriculum metrics."
      />

      {/* Metrics from Real Endpoints */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <span className="text-xs font-semibold text-charcoal-muted">Authored Tracks</span>
          <p className="text-2xl font-bold text-charcoal mt-1">{totalCourses}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <span className="text-xs font-semibold text-charcoal-muted">Published to Learners</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{publishedCount}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <span className="text-xs font-semibold text-charcoal-muted">In Progress Drafts</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{draftCount}</p>
        </div>
      </div>

      {/* Backend Integration Notice */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-border text-center space-y-2">
        <BarChart3 className="w-8 h-8 text-slate-400 mx-auto" />
        <h4 className="text-sm font-bold text-charcoal">Advanced Telemetry & Learner Analytics</h4>
        <p className="text-xs text-charcoal-muted max-w-md mx-auto">
          Detailed completion drop-off charts and cohort metrics will activate once platform telemetry endpoints are enabled on the backend.
        </p>
      </div>
    </div>
  );
};
