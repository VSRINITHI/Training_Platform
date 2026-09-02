import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Video,
  FileText,
  UploadCloud,
  Trash2,
  CheckCircle2,
  Loader2,
  File,
  ExternalLink,
} from 'lucide-react';
import { lessonsApi } from '../../api/lessons';
import { uploadsApi } from '../../api/uploads';
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
  video_url: z.string().optional().or(z.literal('')),
  document_url: z.string().optional().or(z.literal('')),
});

type LessonFormData = z.infer<typeof lessonSchema>;

export const LessonEditorPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [isDocUploading, setIsDocUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const { data: lesson, isLoading } = useQuery({
    queryKey: ['instructor-lesson-edit', lessonId],
    queryFn: () => lessonsApi.get(lessonId!),
    enabled: Boolean(lessonId),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LessonFormData>({
    resolver: zodResolver(lessonSchema),
  });

  const currentVideoUrl = watch('video_url');
  const currentDocumentUrl = watch('document_url');

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

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (<= 200MB)
    if (file.size > 200 * 1024 * 1024) {
      toastError('File Too Large', 'Lecture videos must be 200MB or smaller.');
      return;
    }

    setIsVideoUploading(true);
    try {
      const res = await uploadsApi.uploadVideo(file);
      setValue('video_url', res.url);
      success('Video Uploaded', `Uploaded ${file.name} to lesson-videos.`);
    } catch (err: any) {
      toastError('Video Upload Failed', err.response?.data?.detail || err.message || 'Upload error');
    } finally {
      setIsVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (<= 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toastError('File Too Large', 'Study documents must be 50MB or smaller.');
      return;
    }

    setIsDocUploading(true);
    try {
      const res = await uploadsApi.uploadMaterial(file);
      setValue('document_url', res.url);
      success('Material Uploaded', `Uploaded ${file.name} to lesson-materials.`);
    } catch (err: any) {
      toastError('Upload Failed', err.response?.data?.detail || err.message || 'Upload error');
    } finally {
      setIsDocUploading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

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

        {lesson?.module_id && (
          <Link to={`/instructor/modules/${lesson.module_id}/ai-generate`}>
            <Button size="sm" variant="outline" leftIcon={<Sparkles className="w-3.5 h-3.5 text-primary" />}>
              Module Assessment AI
            </Button>
          </Link>
        )}
      </div>

      <PageHeader
        title={`Edit Lesson: ${lesson?.title || ''}`}
        description="Write lesson notes, upload in-platform lecture videos, and attach supplementary documents (PDF, DOCX)."
      />

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
            placeholder="Write comprehensive lesson materials, code examples, or explanations..."
            rows={10}
            error={errors.content_body?.message}
            {...register('content_body')}
          />

          {/* ========================================================================= */}
          {/* SECTION: Video Lecture Upload (In-Platform, Supabase Storage)             */}
          {/* ========================================================================= */}
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-charcoal flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-primary" />
                  <span>Lesson Video Lecture (In-Platform Video)</span>
                </label>
                <p className="text-[11px] text-charcoal-muted">
                  Upload MP4, WebM, or QuickTime video directly to platform storage (Max: 200MB).
                </p>
              </div>

              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                className="hidden"
                onChange={handleVideoFileChange}
              />

              <Button
                type="button"
                size="sm"
                variant="outline"
                isLoading={isVideoUploading}
                onClick={() => videoInputRef.current?.click()}
                leftIcon={<UploadCloud className="w-4 h-4 text-primary" />}
              >
                {currentVideoUrl ? 'Replace Video' : 'Upload Video'}
              </Button>
            </div>

            {currentVideoUrl ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-indigo-50 text-primary rounded-lg flex items-center justify-center shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-charcoal">Attached Video</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <p className="text-[11px] text-charcoal-muted truncate max-w-sm sm:max-w-md font-mono">
                      {currentVideoUrl}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={currentVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Preview</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setValue('video_url', '')}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Remove Video"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : null}

            <Input
              placeholder="Or paste direct video URL (e.g. /static/uploads/... or https://...)"
              error={errors.video_url?.message}
              {...register('video_url')}
            />
          </div>

          {/* ========================================================================= */}
          {/* SECTION: Lesson Study Materials (PDF, Documents)                         */}
          {/* ========================================================================= */}
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-charcoal flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Lesson Study Materials (PDF & Documents)</span>
                </label>
                <p className="text-[11px] text-charcoal-muted">
                  Upload PDF, DOCX, PPTX, or TXT study resources (Max: 50MB).
                </p>
              </div>

              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={handleDocFileChange}
              />

              <Button
                type="button"
                size="sm"
                variant="outline"
                isLoading={isDocUploading}
                onClick={() => docInputRef.current?.click()}
                leftIcon={<UploadCloud className="w-4 h-4 text-emerald-600" />}
              >
                {currentDocumentUrl ? 'Replace Document' : 'Upload Document'}
              </Button>
            </div>

            {currentDocumentUrl ? (
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
                    <File className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-charcoal">Attached Material</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-charcoal-muted truncate max-w-sm sm:max-w-md font-mono">
                      {currentDocumentUrl}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={currentDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setValue('document_url', '')}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Remove Document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : null}

            <Input
              placeholder="Or paste direct document URL (e.g. https://... or /static/uploads/...)"
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
