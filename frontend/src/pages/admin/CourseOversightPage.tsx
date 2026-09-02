import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  Eye,
  Globe,
  SlidersHorizontal,
  User,
  Edit,
  Trash2,
  Layers,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Course } from '../../types';

export const CourseOversightPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  // Admin retrieves all platform courses using my_authored: true
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['admin-courses-oversight'],
    queryFn: () => coursesApi.list({ my_authored: true }),
  });

  // Publish / Unpublish Mutation
  const publishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      if (isPublished) {
        return coursesApi.unpublish(id);
      } else {
        return coursesApi.publish(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses-oversight'] });
      success('Status Updated', 'Course publication state updated.');
    },
    onError: (err: any) => {
      toastError('Action Failed', err.message);
    },
  });

  // Delete Course Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => coursesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses-oversight'] });
      success('Course Deleted', 'The course and its associated curriculum have been removed.');
      setCourseToDelete(null);
    },
    onError: (err: any) => {
      toastError('Delete Failed', err.message);
    },
  });

  const publishedCount = useMemo(() => courses.filter((c) => c.is_published).length, [courses]);
  const draftCount = useMemo(() => courses.filter((c) => !c.is_published).length, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.sub_domain?.name && c.sub_domain.name.toLowerCase().includes(q)) ||
        (c.instructor?.full_name && c.instructor.full_name.toLowerCase().includes(q)) ||
        (c.instructor?.email && c.instructor.email.toLowerCase().includes(q));

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
        title="Platform Course Oversight"
        description="Inspect, preview, modify, publish/unpublish, or delete all platform courses with full administrative authority."
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-charcoal">
            {courses.length} Total Tracks
          </span>
        }
      />

      {/* Search and Status Filters */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-96">
          <SearchInput
            placeholder="Search by title, instructor, or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
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

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <EmptyState
          title={search ? 'No Matching Courses' : 'No Courses Available'}
          description={
            search
              ? `No platform courses matched your query "${search}".`
              : 'No courses exist in this category.'
          }
          actionLabel={search ? 'Clear Search' : undefined}
          onAction={search ? () => setSearch('') : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-charcoal-muted">
                <tr>
                  <th className="px-6 py-3.5">Course Title</th>
                  <th className="px-6 py-3.5">Instructor</th>
                  <th className="px-6 py-3.5">Topic / Sub-Domain</th>
                  <th className="px-6 py-3.5">Difficulty</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-charcoal">
                {filteredCourses.map((course) => (
                  <tr key={course.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 max-w-xs">
                      <p className="font-bold text-charcoal truncate">{course.title}</p>
                      <p className="text-xs text-charcoal-muted line-clamp-1">{course.description}</p>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <p className="font-semibold text-charcoal">
                        {course.instructor?.full_name || 'System / Seed'}
                      </p>
                      <p className="text-[11px] text-charcoal-muted truncate max-w-[150px]">
                        {course.instructor?.email || ''}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-primary">
                      {course.sub_domain?.name || 'General'}
                    </td>
                    <td className="px-6 py-4">
                      {course.difficulty_level && (
                        <Badge variant="outline" size="sm">
                          {course.difficulty_level}
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {course.is_published ? (
                        <Badge variant="success" size="sm">
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Draft / Unpublished
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* View / Curriculum Details */}
                        <Link
                          to={`/instructor/courses/${course.id}/curriculum`}
                          title="View Curriculum"
                        >
                          <Button size="sm" variant="ghost" className="p-1.5 text-charcoal-muted hover:text-primary">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>

                        {/* Edit Metadata */}
                        <Link
                          to={`/instructor/courses/${course.id}/edit`}
                          title="Edit Course"
                        >
                          <Button size="sm" variant="ghost" className="p-1.5 text-charcoal-muted hover:text-primary">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>

                        {/* Publish / Unpublish Toggle */}
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
                          className="text-xs"
                        >
                          {course.is_published ? 'Unpublish' : 'Publish'}
                        </Button>

                        {/* Delete Course */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 p-1.5"
                          onClick={() => setCourseToDelete(course)}
                          title="Delete Course"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {courseToDelete && (
        <ConfirmDialog
          isOpen={Boolean(courseToDelete)}
          onClose={() => setCourseToDelete(null)}
          onConfirm={() => deleteMutation.mutate(courseToDelete.id)}
          title="Delete Platform Course"
          message={`Are you sure you want to delete "${courseToDelete.title}"? This will permanently remove the course, all its modules, lessons, and quizzes platform-wide.`}
          confirmLabel="Delete Course"
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
};
