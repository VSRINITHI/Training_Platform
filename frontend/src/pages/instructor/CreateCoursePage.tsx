import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PlusCircle, ArrowLeft, Award } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { subDomainsApi } from '../../api/subDomains';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';

const courseSchema = z.object({
  title: z.string().min(3, 'Course title must be at least 3 characters'),
  slug: z.string().min(3, 'URL slug is required (e.g. python-mastery)'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  sub_domain_id: z.string().uuid('Please select a valid sub-domain/topic'),
  difficulty_level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const),
  prerequisites: z.string().optional(),
  learning_outcomes: z.string().optional(),
  has_certificate: z.enum(['true', 'false']),
});

type CourseFormInput = z.infer<typeof courseSchema>;

export const CreateCoursePage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const { data: subDomains = [] } = useQuery({
    queryKey: ['create-course-subdomains'],
    queryFn: () => subDomainsApi.list(),
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CourseFormInput>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      difficulty_level: 'BEGINNER',
      has_certificate: 'true',
      prerequisites: '',
      learning_outcomes: '',
    },
  });

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
    mutationFn: (data: CourseFormInput) => {
      const prerequisitesList = data.prerequisites
        ? data.prerequisites.split('\n').map((s) => s.trim()).filter(Boolean)
        : [];
      const learningOutcomesList = data.learning_outcomes
        ? data.learning_outcomes.split('\n').map((s) => s.trim()).filter(Boolean)
        : [];

      return coursesApi.create({
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
    onSuccess: (newCourse) => {
      success('Course Created', 'Course details saved. Now you can build its curriculum.');
      navigate(`/instructor/courses/${newCourse.id}/curriculum`);
    },
    onError: (err: any) => {
      toastError('Creation Failed', err.message);
    },
  });

  const onSubmit = (data: CourseFormInput) => {
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
        description="Define course metadata, learning objectives, prerequisites, and certification settings."
      />

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal-muted">
              Course Details
            </h3>

            <Input
              label="Course Title"
              placeholder="e.g. Python Programming Fundamentals"
              error={errors.title?.message}
              {...register('title')}
              onChange={handleTitleChange}
            />

            <Input
              label="URL Slug"
              placeholder="e.g. python-programming-fundamentals"
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
