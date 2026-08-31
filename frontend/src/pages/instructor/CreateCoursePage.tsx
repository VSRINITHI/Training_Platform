import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PlusCircle, ArrowLeft, BookOpen, Sparkles } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { subDomainsApi } from '../../api/subDomains';
import { domainsApi } from '../../api/domains';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { DifficultyLevel } from '../../types';

const courseSchema = z.object({
  title: z.string().min(3, 'Course title must be at least 3 characters'),
  slug: z.string().min(3, 'URL slug is required (e.g. python-mastery)'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  sub_domain_id: z.string().uuid('Please select a valid sub-domain/topic'),
  difficulty_level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const),
});

type CourseFormData = z.infer<typeof courseSchema>;

export const CreateCoursePage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const { data: subDomains = [], isLoading: loadingSubDomains } = useQuery({
    queryKey: ['create-course-subdomains'],
    queryFn: () => subDomainsApi.list(),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      difficulty_level: 'BEGINNER',
    },
  });

  const titleValue = watch('title');

  // Auto-generate slug from title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setValue('title', title, { shouldValidate: true });
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setValue('slug', slug, { shouldValidate: true });
  };

  const createMutation = useMutation({
    mutationFn: (data: CourseFormData) => coursesApi.create(data),
    onSuccess: (newCourse) => {
      success('Course Created', 'Course details saved. Now you can build its curriculum.');
      navigate(`/instructor/courses/${newCourse.id}/curriculum`);
    },
    onError: (err: any) => {
      toastError('Creation Failed', err.message);
    },
  });

  const onSubmit = (data: CourseFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-xs text-charcoal-muted mb-2">
        <Link to="/instructor/courses" className="hover:text-charcoal hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Courses
        </Link>
      </div>

      <PageHeader
        title="Create New Course"
        description="Define course metadata, target topic, difficulty, and URL slug."
      />

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Course Title"
            placeholder="e.g. Advanced Machine Learning Engineering"
            error={errors.title?.message}
            {...register('title')}
            onChange={handleTitleChange}
          />

          <Input
            label="URL Slug"
            placeholder="e.g. advanced-machine-learning"
            error={errors.slug?.message}
            helperText="Unique identifier for the course URL."
            {...register('slug')}
          />

          <Textarea
            label="Course Description"
            placeholder="Provide a comprehensive summary of what learners will master in this track..."
            rows={4}
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Subject Sub-Domain / Topic"
              error={errors.sub_domain_id?.message}
              placeholder="Select technical topic"
              {...register('sub_domain_id')}
            >
              <option value="" disabled>
                Select technical topic
              </option>
              {subDomains.map((sd) => (
                <option key={sd.id} value={sd.id}>
                  {sd.name} {sd.domain ? `(${sd.domain.name})` : ''}
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
              isLoading={createMutation.isPending}
              leftIcon={<PlusCircle className="w-4 h-4" />}
            >
              Create Course & Build Curriculum
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
