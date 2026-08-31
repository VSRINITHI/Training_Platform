import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusCircle,
  BookOpen,
  Search,
  SlidersHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  Eye,
  Sparkles,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Course } from '../../types';

export const InstructorCoursesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [search, setSearch] = useState('');
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  // Fetch Courses
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['instructor-courses-list'],
    queryFn: () => coursesApi.list(),
  });

  // Delete Course Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => coursesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-courses-list'] });
      success('Course Deleted', 'The course and its draft curriculum have been removed.');
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

  const filteredCourses = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Management"
        description="Manage your courses, curriculum structures, assessments, and publishing states."
        actions={
          <Link to="/instructor/courses/new">
            <Button size="md" leftIcon={<PlusCircle className="w-4 h-4" />}>
              New Course
            </Button>
          </Link>
        }
      />

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-card flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search your courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Courses List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <EmptyState
          title="No Courses Found"
          description="You haven't created any courses matching your search."
          actionLabel="Create New Course"
          onAction={() => window.location.assign('/instructor/courses/new')}
        />
      ) : (
        <div className="space-y-3">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white p-6 rounded-2xl border border-border shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-charcoal">{course.title}</h3>
                  {course.is_published ? (
                    <Badge variant="success" size="sm">
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      Draft
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
          message={`Are you sure you want to delete "${courseToDelete.title}"? All associated modules and lessons will be removed.`}
          confirmLabel="Delete Course"
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
};
