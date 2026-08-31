import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Sparkles,
  TrendingUp,
  Award,
  ArrowRight,
  Compass,
  PlayCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { progressApi } from '../../api/progress';
import { coursesApi } from '../../api/courses';
import { domainsApi } from '../../api/domains';
import { Course } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { CourseGrid } from '../../components/courses/CourseGrid';
import { DomainCard } from '../../components/courses/DomainCard';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';

export const LearnerDashboardPage: React.FC = () => {
  const { profile } = useAuth();

  // 1. Fetch user's enrollments
  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: progressApi.getMyEnrollments,
  });

  // 2. Fetch personalized or general courses
  const { data: discoveryData, isLoading: loadingCourses } = useQuery({
    queryKey: ['recommended-courses'],
    queryFn: async () => {
      try {
        const disc = await coursesApi.discover();
        if (disc && Array.isArray(disc.matched_courses)) {
          return disc.matched_courses;
        }
        return await coursesApi.list();
      } catch {
        return await coursesApi.list();
      }
    },
  });

  const recommendedCourses: Course[] = Array.isArray(discoveryData) ? discoveryData : [];

  // 3. Fetch top domains
  const { data: domains = [], isLoading: loadingDomains } = useQuery({
    queryKey: ['top-domains'],
    queryFn: domainsApi.list,
  });

  const activeEnrollments = enrollments.filter((e) => e.status === 'ACTIVE');
  const completedEnrollments = enrollments.filter((e) => e.status === 'COMPLETED');
  const enrolledCourseIds = new Set(enrollments.map((e) => e.course_id));

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-primary via-indigo-600 to-primary-emphasis rounded-2xl p-6 sm:p-8 text-white shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold text-indigo-100">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Learner Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hello, {profile?.full_name || 'Learner'}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-indigo-100 max-w-xl leading-relaxed">
            Track your course progress, take modular quizzes, and earn certificates across cutting-edge technology tracks.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link to="/learner/discover">
            <Button
              variant="outline"
              className="bg-white text-primary hover:bg-indigo-50 border-transparent shadow-sm"
              leftIcon={<Compass className="w-4 h-4" />}
            >
              Explore Catalog
            </Button>
          </Link>
          <Link to="/learner/progress">
            <Button
              variant="secondary"
              className="bg-white/10 text-white hover:bg-white/20 border-white/20"
              leftIcon={<TrendingUp className="w-4 h-4" />}
            >
              My Progress
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Active Courses</span>
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-charcoal mt-2">{activeEnrollments.length}</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Completed</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-charcoal mt-2">{completedEnrollments.length}</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Certificates</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-charcoal mt-2">{completedEnrollments.length}</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Explore Tracks</span>
            <Compass className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-charcoal mt-2">{domains.length} Domains</p>
        </div>
      </div>

      {/* Continue Learning Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-primary" />
            <h2 className="text-lg sm:text-xl font-bold text-charcoal">Continue Learning</h2>
          </div>
          <Link to="/learner/progress" className="text-xs font-semibold text-primary hover:underline">
            View All Progress →
          </Link>
        </div>

        {loadingEnrollments ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        ) : activeEnrollments.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-dashed border-border text-center">
            <p className="text-sm font-semibold text-charcoal">You don't have any active courses yet.</p>
            <p className="text-xs text-charcoal-muted mt-1 mb-4">
              Explore our curriculum to enroll in your first competency track.
            </p>
            <Link to="/learner/discover">
              <Button size="sm">Browse Courses</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeEnrollments.map((enr) => (
              <div
                key={enr.id}
                className="bg-white p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-charcoal-muted mb-1.5">
                    <span className="font-semibold text-primary">In Progress</span>
                    <span>Enrolled {new Date(enr.enrolled_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-base font-bold text-charcoal line-clamp-1">
                    {enr.course?.title || 'Active Course'}
                  </h3>
                  <p className="text-xs text-charcoal-muted line-clamp-2 mt-1">
                    {enr.course?.description || 'Access modules, interactive quizzes, and course curriculum.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <Link
                    to={`/learner/learning/${enr.course_id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover"
                  >
                    <span>Resume Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Courses Section */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-charcoal">Recommended for You</h2>
            <p className="text-xs text-charcoal-muted">Curated tracks based on your interests and popular topics</p>
          </div>
          <Link to="/learner/discover" className="text-xs font-semibold text-primary hover:underline">
            View Catalog →
          </Link>
        </div>

        <CourseGrid
          courses={recommendedCourses.slice(0, 6)}
          isLoading={loadingCourses}
          enrolledCourseIds={enrolledCourseIds}
        />
      </div>

      {/* Popular Domains */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-charcoal">Explore Domains</h2>
            <p className="text-xs text-charcoal-muted">Filter courses by technical disciplines and competencies</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {domains.slice(0, 3).map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </div>
      </div>
    </div>
  );
};
