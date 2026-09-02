import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, BookOpen, Award } from 'lucide-react';
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
  prerequisites: z.string().optional(),
  learning_outcomes: z.string().optional(),
  has_certificate: z.enum(['true', 'false']),
});

type CourseFormInput = z.infer<typeof courseSchema>;

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
  } = useForm<CourseFormInput>({
    resolver: zodResolver(courseSchema),
  });

  useEffect(() => {
    if (course) {
      const prereqsStr = Array.isArray(course.prerequisites)
        ? course.prerequisites.join('\n')
        : (course.prerequisites || '');
      const outcomesStr = Array.isArray(course.learning_outcomes)
        ? course.learning_outcomes.join('\n')
        : (course.learning_outcomes || '');

      reset({
        title: course.title,
        slug: course.slug,
        description: course.description,
        sub_domain_id: course.sub_domain_id,
        difficulty_level: (course.difficulty_level as any) || 'BEGINNER',
        prerequisites: prereqsStr,
        learning_outcomes: outcomesStr,
        has_certificate: course.has_certificate !== false ? 'true' : 'false',
      });
    }
  }, [course, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: CourseFormInput) => {
      const prerequisitesList = data.prerequisites
        ? data.prerequisites.split('\n').map((s) => s.trim()).filter(Boolean)
        : [];
      const learningOutcomesList = data.learning_outcomes
        ? data.learning_outcomes.split('\n').map((s) => s.trim()).filter(Boolean)
        : [];

      return coursesApi.update(courseId!, {
        title: data.title,
        slug: data.slug,
        description: data.description,
        sub_domain_id: data.sub_domain_id,
        difficulty_level: data.difficulty_level,
        prerequisites: prerequisitesList.length > 0 ? prerequisitesList : null,
        learning_outcomes: learningOutcomesList.length > 0 ? learningOutcomesList : null,
        has_certificate: data.has_certificate === 'true',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edit-course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['instructor-courses-list'] });
      success('Course Updated', 'Course details have been successfully saved.');
    },
    onError: (err: any) => {
      toastError('Update Failed', err.message);
    },
  });

  const onSubmit = (data: CourseFormInput) => {
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
        description="Update course description, learning objectives, prerequisites, and certification settings."
        actions={
          <Link to={`/instructor/courses/${courseId}/curriculum`}>
            <Button size="sm" variant="outline" leftIcon={<BookOpen className="w-4 h-4" />}>
              Curriculum Tree
            </Button>
          </Link>
        }
      />

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal-muted">
              Course Details
            </h3>

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
          </div>

          {/* Professional Metadata */}
          <div className="pt-6 border-t border-border space-y-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal-muted">
              Professional Course Metadata
            </h3>

            <div>
              <Textarea
                label="Prerequisites"
                placeholder={`Basic computer literacy\nFamiliarity with using a web browser\nNo prior programming experience required`}
                helperText="List the knowledge or skills learners should have before starting this course. Enter one prerequisite per line."
                rows={3}
                error={errors.prerequisites?.message}
                {...register('prerequisites')}
              />
            </div>

            <div>
              <Textarea
                label="Learning Outcomes"
                placeholder={`Understand Python syntax and core programming concepts\nWrite reusable functions and modular programs\nWork with Python lists, dictionaries, tuples, and sets\nBuild small practical Python applications`}
                helperText="Describe what learners will be able to do after completing this course. Enter one outcome per line."
                rows={4}
                error={errors.learning_outcomes?.message}
                {...register('learning_outcomes')}
              />
            </div>

            <div className="bg-sand/30 p-4 rounded-xl border border-border space-y-2">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-teal" />
                <label className="text-sm font-semibold text-charcoal">Certificate Availability</label>
              </div>
              <p className="text-xs text-charcoal-muted">
                Choose whether learners earn an official verified certificate upon satisfying all course completion prerequisites.
              </p>
              <Select
                error={errors.has_certificate?.message}
                {...register('has_certificate')}
              >
                <option value="true">Certificate available upon completion</option>
                <option value="false">No certificate</option>
              </Select>
            </div>
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
