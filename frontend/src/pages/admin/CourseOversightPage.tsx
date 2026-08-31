import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';

export const CourseOversightPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [search, setSearch] = useState('');

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['admin-courses-oversight'],
    queryFn: () => coursesApi.list(),
  });

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

  const filteredCourses = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Course Oversight"
        description="Inspect all platform courses, view authoring instructors, and regulate publication states."
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-charcoal">
            {courses.length} Total Tracks
          </span>
        }
      />

      <div className="bg-white p-4 rounded-xl border border-border shadow-card">
        <Input
          placeholder="Search all courses by title or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-charcoal-muted">
                <tr>
                  <th className="px-6 py-3.5">Course Title</th>
                  <th className="px-6 py-3.5">Topic / Sub-Domain</th>
                  <th className="px-6 py-3.5">Difficulty</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Publication Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-charcoal">
                {filteredCourses.map((course) => (
                  <tr key={course.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-charcoal">{course.title}</p>
                      <p className="text-xs text-charcoal-muted line-clamp-1">{course.description}</p>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-primary">
                      {course.sub_domain?.name || 'General'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" size="sm">
                        {course.difficulty_level || 'Beginner'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {course.is_published ? (
                        <Badge variant="success" size="sm">
                          Live in Catalog
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Draft
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
