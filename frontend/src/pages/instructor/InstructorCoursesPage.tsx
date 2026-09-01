import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusCircle,
  BookOpen,
  Edit,
  Trash2,
  CheckCircle,
  Eye,
  SlidersHorizontal,
  FolderPlus,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Course } from '../../types';

export const InstructorCoursesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  // Fetch all authored courses (including draft/unpublished)
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['instructor-courses-list'],
    queryFn: () => coursesApi.list({ my_authored: true }),
  });

  // Delete Course Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => coursesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-courses-list'] });
      success('Course Deleted', 'The course and its curriculum have been removed.');
      setCourseToDelete(null);
    },
    onError: (err: any) => {
      toastError('Delete Failed', err.message);
    },
  });

  // Publish Toggle Mutation
  const publishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      if (isPublished) {
        return coursesApi.unpublish(id);
      } else {
        return coursesApi.publish(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-courses-list'] });
      success('Status Updated', 'Course publication status updated.');
    },
    onError: (err: any) => {
      toastError('Action Failed', err.message);
    },
  });

  const publishedCount = useMemo(() => courses.filter((c) => c.is_published).length, [courses]);
  const draftCount = useMemo(() => courses.filter((c) => !c.is_published).length, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase()) ||
        (c.sub_domain?.name && c.sub_domain.name.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'PUBLISHED'
          ? c.is_published
          : !c.is_published;

      return matchesSearch && matchesStatus;
    });
  }, [courses, search, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Management"
        description="Manage your created courses, curriculum structure, quizzes, and publication states."
        actions={
          <Link to="/instructor/courses/new">
            <Button size="md" leftIcon={<PlusCircle className="w-4 h-4" />}>
              New Course
            </Button>
          </Link>
        }
      />

      {/* Search and Status Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="w-full sm:w-96">
          <SearchInput
            placeholder="Search courses by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'ALL'
                ? 'bg-white text-primary shadow-sm'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            All ({courses.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PUBLISHED')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'PUBLISHED'
                ? 'bg-white text-primary shadow-sm'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            Published ({publishedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('DRAFT')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'DRAFT'
                ? 'bg-white text-primary shadow-sm'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            Draft / Unpublished ({draftCount})
          </button>
        </div>
      </div>

      {/* Courses List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <EmptyState
          title={search ? 'No Matching Courses' : 'No Courses Found'}
          description={
            search
              ? `No courses matched your query "${search}". Try adjusting your keywords or clearing the filter.`
              : "You haven't created any courses in this filter tab yet."
          }
          actionLabel={search ? 'Clear Search' : 'Create New Course'}
          onAction={
            search ? () => setSearch('') : () => window.location.assign('/instructor/courses/new')
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white p-6 rounded-2xl border border-border shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-charcoal">{course.title}</h3>
                  {course.is_published ? (
                    <Badge variant="success" size="sm">
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      Draft / Unpublished
                    </Badge>
                  )}
                  {course.difficulty_level && (
                    <Badge variant="outline" size="sm">
                      {course.difficulty_level}
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-charcoal-muted line-clamp-2 leading-relaxed">
                  {course.description}
                </p>

                <div className="text-[11px] text-charcoal-muted pt-1">
                  Topic: <strong>{course.sub_domain?.name || 'General'}</strong> • Created:{' '}
                  {new Date(course.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Link to={`/instructor/courses/${course.id}/curriculum`}>
                  <Button size="sm" variant="outline">
                    Curriculum Tree
                  </Button>
                </Link>

                <Link to={`/instructor/courses/${course.id}/quizzes`}>
                  <Button size="sm" variant="outline">
                    Quizzes
                  </Button>
                </Link>

                <Link to={`/instructor/courses/${course.id}/edit`}>
                  <Button size="sm" variant="outline" leftIcon={<Edit className="w-3.5 h-3.5" />}>
                    Edit
                  </Button>
                </Link>

                <Button
                  size="sm"
                  variant={course.is_published ? 'outline' : 'primary'}
                  isLoading={publishMutation.isPending}
                  onClick={() =>
                    publishMutation.mutate({
                      id: course.id,
                      isPublished: course.is_published,
                    })
                  }
                >
                  {course.is_published ? 'Unpublish' : 'Publish'}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 p-2"
                  onClick={() => setCourseToDelete(course)}
                  title="Delete Course"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {courseToDelete && (
        <ConfirmDialog
          isOpen={Boolean(courseToDelete)}
          onClose={() => setCourseToDelete(null)}
          onConfirm={() => deleteMutation.mutate(courseToDelete.id)}
          title="Delete Course"
          message={`Are you sure you want to delete "${courseToDelete.title}"? All associated modules, lessons, and draft quizzes will be removed.`}
          confirmLabel="Delete Course"
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
};
