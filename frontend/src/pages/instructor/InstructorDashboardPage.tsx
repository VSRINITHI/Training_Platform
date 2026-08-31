import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  PlusCircle,
  Sparkles,
  Eye,
  CheckCircle2,
  Users,
  Award,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';

export const InstructorDashboardPage: React.FC = () => {
  const { profile } = useAuth();

  // Fetch courses authored by instructor
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['instructor-courses'],
    queryFn: () => coursesApi.list(),
  });

  const publishedCourses = courses.filter((c) => c.is_published);
  const draftCourses = courses.filter((c) => !c.is_published);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, Instructor ${profile?.full_name?.split(' ')[0] || ''}`}
        description="Author courses, build structured curriculums, configure quizzes, review AI drafts, and publish."
        actions={
          <Link to="/instructor/courses/new">
            <Button size="md" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Create New Course
            </Button>
          </Link>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <span className="text-xs font-semibold text-charcoal-muted">Total Courses</span>
          <p className="text-2xl font-bold text-charcoal mt-1">{courses.length}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <span className="text-xs font-semibold text-charcoal-muted">Published</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{publishedCourses.length}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <span className="text-xs font-semibold text-charcoal-muted">Drafts</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{draftCourses.length}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <span className="text-xs font-semibold text-charcoal-muted">AI Review Queue</span>
          <p className="text-2xl font-bold text-primary mt-1">Ready</p>
        </div>
      </div>

      {/* Course Management Table / Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-charcoal">Authored Courses</h2>
          <Link to="/instructor/courses" className="text-xs font-semibold text-primary hover:underline">
            View all courses →
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-border text-center space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-charcoal">You haven't authored any courses yet</h3>
            <p className="text-xs text-charcoal-muted max-w-sm mx-auto">
              Create your first course to build modules, lessons, and assessment checkpoints.
            </p>
            <Link to="/instructor/courses/new">
              <Button size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                Create Course
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.slice(0, 5).map((course) => (
              <div
                key={course.id}
                className="bg-white p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-charcoal">{course.title}</h3>
                    {course.is_published ? (
                      <Badge variant="success" size="sm">
                        Published
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        Draft
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-charcoal-muted line-clamp-1">
                    {course.sub_domain?.name || 'Technical Track'} • {course.difficulty_level || 'All Levels'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/instructor/courses/${course.id}/curriculum`}>
                    <Button size="sm" variant="outline">
                      Curriculum
                    </Button>
                  </Link>
                  <Link to={`/instructor/courses/${course.id}/edit`}>
                    <Button size="sm">Edit Course</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
