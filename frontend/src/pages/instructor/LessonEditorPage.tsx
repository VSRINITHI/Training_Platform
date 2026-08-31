import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Sparkles, Video, FileText } from 'lucide-react';
import { lessonsApi } from '../../api/lessons';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';

const lessonSchema = z.object({
  title: z.string().min(2, 'Lesson title is required'),
  duration_minutes: z.number().min(1).optional().nullable(),
  content_body: z.string().optional().nullable(),
  video_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  document_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type LessonFormData = z.infer<typeof lessonSchema>;

export const LessonEditorPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const { data: lesson, isLoading } = useQuery({
    queryKey: ['instructor-lesson-edit', lessonId],
    queryFn: () => lessonsApi.get(lessonId!),
    enabled: Boolean(lessonId),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LessonFormData>({
    resolver: zodResolver(lessonSchema),
  });

  useEffect(() => {
    if (lesson) {
      reset({
        title: lesson.title,
        duration_minutes: lesson.duration_minutes ?? 15,
        content_body: lesson.content_body ?? '',
        video_url: lesson.video_url ?? '',
        document_url: lesson.document_url ?? '',
      });
    }
  }, [lesson, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: LessonFormData) =>
      lessonsApi.update(lessonId!, {
        title: data.title,
        duration_minutes: data.duration_minutes ? Number(data.duration_minutes) : null,
        content_body: data.content_body || null,
        video_url: data.video_url || null,
        document_url: data.document_url || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-lesson-edit', lessonId] });
      success('Lesson Saved', 'Lesson content and resources updated.');
    },
    onError: (err: any) => {
      toastError('Save Failed', err.message);
    },
  });

  const onSubmit = (data: LessonFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return <LoadingState message="Loading lesson editor..." className="py-24" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-charcoal-muted hover:text-charcoal hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Curriculum
        </button>

        <Link to={`/instructor/lessons/${lessonId}/ai-generate`}>
          <Button size="sm" variant="outline" leftIcon={<Sparkles className="w-3.5 h-3.5 text-primary" />}>
            Generate AI Quiz Draft
          </Button>
        </Link>
      </div>

      <PageHeader
        title={`Edit Lesson: ${lesson?.title || ''}`}
        description="Write lesson notes, attach lecture video URLs, and link study documents."
      />

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input label="Lesson Title" error={errors.title?.message} {...register('title')} />
            </div>
            <div>
              <Input
                label="Duration (Minutes)"
                type="number"
                error={errors.duration_minutes?.message}
                {...register('duration_minutes', { valueAsNumber: true })}
              />
            </div>
          </div>

          <Textarea
            label="Lesson Content / Notes (Markdown supported)"
            placeholder="Write clear, comprehensive lesson materials, code examples, or explanations..."
            rows={12}
            error={errors.content_body?.message}
            {...register('content_body')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <Input
              label="Video Lecture URL (Optional)"
              placeholder="https://youtube.com/watch?v=..."
              leftIcon={<Video className="w-4 h-4 text-slate-400" />}
              error={errors.video_url?.message}
              {...register('video_url')}
            />

            <Input
              label="Document / PDF URL (Optional)"
              placeholder="https://example.com/notes.pdf"
              leftIcon={<FileText className="w-4 h-4 text-slate-400" />}
              error={errors.document_url?.message}
              {...register('document_url')}
            />
          </div>

          <div className="pt-6 border-t border-border flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Back
            </Button>

            <Button
              type="submit"
              size="md"
              isLoading={updateMutation.isPending}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Lesson
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
