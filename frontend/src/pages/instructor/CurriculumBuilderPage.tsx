import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  BookOpen,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  ArrowLeft,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { modulesApi } from '../../api/modules';
import { lessonsApi } from '../../api/lessons';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Checkbox } from '../../components/ui/Checkbox';
import { LoadingState } from '../../components/ui/LoadingState';
import { ModuleDetail, LessonItem } from '../../types';

export const CurriculumBuilderPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  // Module modal state
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDesc, setModuleDesc] = useState('');
  const [moduleRequired, setModuleRequired] = useState(true);

  // Lesson modal state
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDuration, setLessonDuration] = useState<number>(15);

  // Fetch Course details
  const { data: course, isLoading } = useQuery({
    queryKey: ['curriculum-course', courseId],
    queryFn: () => coursesApi.get(courseId!),
    enabled: Boolean(courseId),
  });

  // Create Module Mutation
  const createModuleMutation = useMutation({
    mutationFn: () =>
      modulesApi.create(courseId!, {
        title: moduleTitle,
        description: moduleDesc || undefined,
        is_required: moduleRequired,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-course', courseId] });
      success('Module Created', 'New chapter added to the curriculum.');
      setIsModuleModalOpen(false);
      setModuleTitle('');
      setModuleDesc('');
    },
    onError: (err: any) => {
      toastError('Failed to create module', err.message);
    },
  });

  // Delete Module Mutation
  const deleteModuleMutation = useMutation({
    mutationFn: (moduleId: string) => modulesApi.delete(moduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-course', courseId] });
      success('Module Deleted', 'Module and lessons have been removed.');
    },
    onError: (err: any) => {
      toastError('Delete Failed', err.message);
    },
  });

  // Create Lesson Mutation
  const createLessonMutation = useMutation({
    mutationFn: () =>
      lessonsApi.create(selectedModuleId!, {
        title: lessonTitle,
        duration_minutes: Number(lessonDuration) || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-course', courseId] });
      success('Lesson Created', 'Lesson added to the chapter.');
      setIsLessonModalOpen(false);
      setLessonTitle('');
    },
    onError: (err: any) => {
      toastError('Failed to create lesson', err.message);
    },
  });

  // Delete Lesson Mutation
  const deleteLessonMutation = useMutation({
    mutationFn: (lessonId: string) => lessonsApi.delete(lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-course', courseId] });
      success('Lesson Deleted', 'Lesson removed from module.');
    },
    onError: (err: any) => {
      toastError('Delete Failed', err.message);
    },
  });

  // Reorder Modules
  const handleMoveModule = async (index: number, direction: 'up' | 'down') => {
    if (!course?.modules) return;
    const items = [...course.modules];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const [moved] = items.splice(index, 1);
    items.splice(targetIdx, 0, moved);

    const payload = items.map((m, idx) => ({ id: m.id, order_index: idx + 1 }));
    try {
      await modulesApi.reorder(courseId!, { items: payload });
      queryClient.invalidateQueries({ queryKey: ['curriculum-course', courseId] });
    } catch (err: any) {
      toastError('Reorder Failed', err.message);
    }
  };

  // Reorder Lessons
  const handleMoveLesson = async (
    moduleId: string,
    lessons: LessonItem[],
    index: number,
    direction: 'up' | 'down'
  ) => {
    const items = [...lessons];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const [moved] = items.splice(index, 1);
    items.splice(targetIdx, 0, moved);

    const payload = items.map((l, idx) => ({ id: l.id, order_index: idx + 1 }));
    try {
      await lessonsApi.reorder(moduleId, { items: payload });
      queryClient.invalidateQueries({ queryKey: ['curriculum-course', courseId] });
    } catch (err: any) {
      toastError('Reorder Failed', err.message);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading curriculum tree..." className="py-24" />;
  }

  const modules = course?.modules || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-charcoal-muted mb-2">
        <Link to="/instructor/courses" className="hover:text-charcoal hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Courses
        </Link>
      </div>

      <PageHeader
        title={`Curriculum Builder: ${course?.title}`}
        description="Add module chapters, sequential lessons, and configure competency assessments."
        actions={
          <Button
            size="md"
            onClick={() => setIsModuleModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Module
          </Button>
        }
      />

      {/* Curriculum Tree List */}
      {modules.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-dashed border-border text-center space-y-3">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-charcoal">No Curriculum Modules Yet</h3>
          <p className="text-xs text-charcoal-muted max-w-sm mx-auto">
            Click "Add Module" to start structuring your course into chapters.
          </p>
          <Button size="sm" onClick={() => setIsModuleModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Add First Module
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {modules.map((module, mIdx) => (
            <div key={module.id} className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-4">
              {/* Module Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary-light text-primary font-bold text-xs">
                    {mIdx + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-charcoal">{module.title}</h3>
                    {module.description && (
                      <p className="text-xs text-charcoal-muted mt-0.5">{module.description}</p>
                    )}
                  </div>
                </div>

                {/* Module Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleMoveModule(mIdx, 'up')}
                    disabled={mIdx === 0}
                    className="p-1.5 text-slate-400 hover:text-charcoal disabled:opacity-30 rounded"
                    title="Move Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMoveModule(mIdx, 'down')}
                    disabled={mIdx === modules.length - 1}
                    className="p-1.5 text-slate-400 hover:text-charcoal disabled:opacity-30 rounded"
                    title="Move Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedModuleId(module.id);
                      setIsLessonModalOpen(true);
                    }}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Add Lesson
                  </Button>

                  <button
                    onClick={() => {
                      if (window.confirm(`Delete module "${module.title}" and its lessons?`)) {
                        deleteModuleMutation.mutate(module.id);
                      }
                    }}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                    title="Delete Module"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Lessons Inside Module */}
              <div className="pl-4 sm:pl-10 space-y-2">
                {module.lessons && module.lessons.length > 0 ? (
                  module.lessons.map((lesson, lIdx) => (
                    <div
                      key={lesson.id}
                      className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-semibold text-charcoal truncate">
                          {lIdx + 1}. {lesson.title}
                        </span>
                        {lesson.duration_minutes && (
                          <span className="text-[11px] text-slate-400 shrink-0">
                            ({lesson.duration_minutes} min)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Move Lesson */}
                        <button
                          onClick={() => handleMoveLesson(module.id, module.lessons, lIdx, 'up')}
                          disabled={lIdx === 0}
                          className="p-1 text-slate-400 hover:text-charcoal disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveLesson(module.id, module.lessons, lIdx, 'down')}
                          disabled={lIdx === module.lessons.length - 1}
                          className="p-1 text-slate-400 hover:text-charcoal disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* AI Generate Quiz Draft for this Lesson */}
                        <Link to={`/instructor/lessons/${lesson.id}/ai-generate`}>
                          <Button size="sm" variant="outline" leftIcon={<Sparkles className="w-3 h-3 text-primary" />}>
                            AI Quiz Draft
                          </Button>
                        </Link>

                        {/* Edit Lesson */}
                        <Link to={`/instructor/lessons/${lesson.id}`}>
                          <Button size="sm" variant="outline" leftIcon={<Edit className="w-3 h-3" />}>
                            Edit Content
                          </Button>
                        </Link>

                        <button
                          onClick={() => {
                            if (window.confirm(`Delete lesson "${lesson.title}"?`)) {
                              deleteLessonMutation.mutate(lesson.id);
                            }
                          }}
                          className="p-1 text-rose-500 hover:bg-rose-100 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-charcoal-muted italic py-1">
                    No lessons in this module yet. Click "Add Lesson" above.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Module Modal */}
      <Modal
        isOpen={isModuleModalOpen}
        onClose={() => setIsModuleModalOpen(false)}
        title="Add Curriculum Module"
        description="Chapters organize sequential lessons and module assessment checkpoints."
      >
        <div className="space-y-4">
          <Input
            label="Module Title"
            placeholder="e.g. Module 1: Foundations & Architecture"
            value={moduleTitle}
            onChange={(e) => setModuleTitle(e.target.value)}
          />

          <Textarea
            label="Module Description (Optional)"
            placeholder="What will learners understand after completing this module?"
            value={moduleDesc}
            onChange={(e) => setModuleDesc(e.target.value)}
          />

          <Checkbox
            label="Required Module"
            description="Must be completed by learners before certification graduation."
            checked={moduleRequired}
            onChange={(e) => setModuleRequired(e.target.checked)}
          />

          <div className="pt-4 border-t border-border flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModuleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createModuleMutation.mutate()}
              isLoading={createModuleMutation.isPending}
              disabled={!moduleTitle.trim()}
            >
              Save Module
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Lesson Modal */}
      <Modal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        title="Add Lesson to Module"
        description="Create a new lesson topic with optional duration."
      >
        <div className="space-y-4">
          <Input
            label="Lesson Title"
            placeholder="e.g. Introduction to Syntax and Types"
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
          />

          <Input
            label="Estimated Duration (Minutes)"
            type="number"
            value={lessonDuration}
            onChange={(e) => setLessonDuration(Number(e.target.value))}
          />

          <div className="pt-4 border-t border-border flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsLessonModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createLessonMutation.mutate()}
              isLoading={createLessonMutation.isPending}
              disabled={!lessonTitle.trim()}
            >
              Create Lesson
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
