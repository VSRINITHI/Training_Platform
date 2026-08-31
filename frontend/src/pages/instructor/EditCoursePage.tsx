import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, BookOpen } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { subDomainsApi } from '../../api/subDomains';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';

const courseSchema = z.object({
  title: z.string().min(3, 'Course title must be at least 3 characters'),
  slug: z.string().min(3, 'URL slug is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  sub_domain_id: z.string().uuid('Please select a valid sub-domain'),
  difficulty_level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const),
});

type CourseFormData = z.infer<typeof courseSchema>;

export const EditCoursePage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const { data: course, isLoading: loadingCourse } = useQuery({
    queryKey: ['edit-course', courseId],
    queryFn: () => coursesApi.get(courseId!),
    enabled: Boolean(courseId),
  });

  const { data: subDomains = [] } = useQuery({
    queryKey: ['create-course-subdomains'],
    queryFn: () => subDomainsApi.list(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
  });

  useEffect(() => {
    if (course) {
      reset({
        title: course.title,
        slug: course.slug,
        description: course.description,
        sub_domain_id: course.sub_domain_id,
        difficulty_level: (course.difficulty_level as any) || 'BEGINNER',
      });
    }
  }, [course, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: CourseFormData) => coursesApi.update(courseId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edit-course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['instructor-courses-list'] });
      success('Course Updated', 'Course details have been successfully saved.');
    },
    onError: (err: any) => {
      toastError('Update Failed', err.message);
    },
  });

  const onSubmit = (data: CourseFormData) => {
    updateMutation.mutate(data);
  };

  if (loadingCourse) {
    return <LoadingState message="Loading course details..." className="py-24" />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-xs text-charcoal-muted mb-2">
        <Link to="/instructor/courses" className="hover:text-charcoal hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Courses
        </Link>
      </div>

      <PageHeader
        title={`Edit Course: ${course?.title || ''}`}
        description="Update course description, technical topic classification, and level."
        actions={
          <Link to={`/instructor/courses/${courseId}/curriculum`}>
            <Button size="sm" variant="outline" leftIcon={<BookOpen className="w-4 h-4" />}>
              Curriculum Tree
            </Button>
          </Link>
        }
      />

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input label="Course Title" error={errors.title?.message} {...register('title')} />

          <Input label="URL Slug" error={errors.slug?.message} {...register('slug')} />

          <Textarea
            label="Course Description"
            rows={4}
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Subject Sub-Domain / Topic"
              error={errors.sub_domain_id?.message}
              {...register('sub_domain_id')}
            >
              {subDomains.map((sd) => (
                <option key={sd.id} value={sd.id}>
                  {sd.name}
                </option>
              ))}
            </Select>

            <Select
              label="Difficulty Level"
              error={errors.difficulty_level?.message}
              {...register('difficulty_level')}
            >
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </Select>
          </div>

          <div className="pt-6 border-t border-border flex items-center justify-between">
            <Link to="/instructor/courses">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>

            <Button
              type="submit"
              size="md"
              isLoading={updateMutation.isPending}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
