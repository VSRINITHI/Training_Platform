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
  Award,
  Layers,
  HelpCircle,
  Eye,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { modulesApi } from '../../api/modules';
import { lessonsApi } from '../../api/lessons';
import { quizzesApi } from '../../api/quizzes';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Checkbox } from '../../components/ui/Checkbox';
import { LoadingState } from '../../components/ui/LoadingState';
import { ModuleDetail, LessonItem, QuizType } from '../../types';

export const CurriculumBuilderPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState('');
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

  // Manual Quiz Modal state
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizTargetType, setQuizTargetType] = useState<QuizType>('MODULE');
  const [quizTargetId, setQuizTargetId] = useState<string>('');
  const [quizTitle, setQuizTitle] = useState('');
  const [quizPassingScore, setQuizPassingScore] = useState<number>(70);
  const [quizMaxAttempts, setQuizMaxAttempts] = useState<number>(2);

  // Fetch Course details (includes module.quiz and course.final_quiz)
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

  // Create Quiz Mutation
  const createQuizMutation = useMutation({
    mutationFn: () =>
      quizzesApi.create({
        title: quizTitle,
        quiz_type: quizTargetType,
        passing_score: Number(quizPassingScore),
        max_attempts: Number(quizMaxAttempts),
        course_id: quizTargetType === 'FINAL' ? courseId : undefined,
        module_id: quizTargetType === 'MODULE' ? quizTargetId : undefined,
      }),
    onSuccess: (newQuiz) => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-course', courseId] });
      success('Assessment Checkpoint Created', 'You can now add or edit questions for this quiz.');
      setIsQuizModalOpen(false);
      setQuizTitle('');
    },
    onError: (err: any) => {
      toastError('Failed to create quiz', err.response?.data?.detail || err.message);
    },
  });

  // Delete Quiz Mutation
  const deleteQuizMutation = useMutation({
    mutationFn: (quizId: string) => quizzesApi.delete(quizId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-course', courseId] });
      success('Quiz Deleted', 'Assessment checkpoint deleted successfully.');
    },
    onError: (err: any) => {
      toastError('Delete Failed', err.response?.data?.detail || err.message);
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

  const rawModules = course?.modules || [];

  const modules = rawModules
    .map((mod) => {
      const matchesModule =
        mod.title.toLowerCase().includes(search.toLowerCase()) ||
        (mod.description && mod.description.toLowerCase().includes(search.toLowerCase()));

      const filteredLessons = (mod.lessons || []).filter((l) =>
        l.title.toLowerCase().includes(search.toLowerCase())
      );

      if (matchesModule || filteredLessons.length > 0) {
        return {
          ...mod,
          lessons: matchesModule ? mod.lessons : filteredLessons,
        };
      }
      return null;
    })
    .filter(Boolean) as ModuleDetail[];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-2 text-xs text-charcoal-muted mb-2">
        <Link to="/instructor/courses" className="hover:text-charcoal hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Courses
        </Link>
      </div>

      <PageHeader
        title={`Curriculum Builder: ${course?.title}`}
        description="Add module chapters, sequential lessons, and configure competency assessment checkpoints."
        actions={
          <div className="flex items-center gap-2">
            <Link to={`/instructor/courses/${courseId}/ai-generate`}>
              <Button size="md" variant="outline" leftIcon={<Sparkles className="w-4 h-4 text-primary" />}>
                Generate with AI
              </Button>
            </Link>
            <Button
              size="md"
              onClick={() => setIsModuleModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Module
            </Button>
          </div>
        }
      />

      {/* Search Bar */}
      {rawModules.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-border shadow-card flex items-center gap-3">
          <div className="w-full sm:w-96">
            <SearchInput
              placeholder="Search chapters or lessons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>
          <span className="text-xs font-semibold text-charcoal-muted">
            Showing {modules.length} of {rawModules.length} chapters
          </span>
        </div>
      )}

      {/* Curriculum Tree List */}
      {rawModules.length === 0 ? (
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
      ) : modules.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-border text-center space-y-3 shadow-card">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-charcoal">No Matching Chapters or Lessons</h3>
          <p className="text-xs text-charcoal-muted">
            No curriculum items matched your search "{search}".
          </p>
          <Button size="sm" variant="outline" onClick={() => setSearch('')}>
            Clear Search
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
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
                        {lesson.document_url && (
                          <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium shrink-0">
                            PDF
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

              {/* ========================================================================= */}
              {/* MODULE ASSESSMENT CHECKPOINT BLOCK (Visible under every module)           */}
              {/* ========================================================================= */}
              <div className="pl-4 sm:pl-10 pt-2 border-t border-slate-100">
                {module.quiz ? (
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-white border border-indigo-200 text-primary shrink-0 mt-0.5">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">
                            Module {mIdx + 1} Assessment Checkpoint
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-primary font-bold">
                            {module.quiz.questions_count || 0} Questions
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-charcoal-muted border border-indigo-100 font-medium">
                            Pass: {module.quiz.passing_score}%
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-charcoal mt-0.5">{module.quiz.title}</h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link to={`/instructor/quizzes/${module.quiz.id}/edit`}>
                        <Button size="sm" variant="outline" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                          View / Edit
                        </Button>
                      </Link>
                      <Link to={`/instructor/courses/${courseId}/ai-generate?moduleId=${module.id}`}>
                        <Button size="sm" variant="outline" leftIcon={<Sparkles className="w-3.5 h-3.5 text-primary" />}>
                          Generate AI
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50"
                        onClick={() => {
                          if (module.quiz && window.confirm("Delete this quiz?\n\nThis will remove the quiz and its questions. This action cannot be undone.")) {
                            deleteQuizMutation.mutate(module.quiz.id);
                          }
                        }}
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        Delete Quiz
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-charcoal-muted">
                      <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        <strong>No Module Checkpoint Configured</strong> — Add assessment questions to enforce competency unlock.
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setQuizTargetType('MODULE');
                          setQuizTargetId(module.id);
                          setQuizTitle(`Module ${mIdx + 1}: ${module.title} Checkpoint`);
                          setQuizPassingScore(70);
                          setQuizMaxAttempts(2);
                          setIsQuizModalOpen(true);
                        }}
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                      >
                        Create Manually
                      </Button>
                      <Link to={`/instructor/courses/${courseId}/ai-generate?moduleId=${module.id}`}>
                        <Button size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
                          Generate with AI
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* ========================================================================= */}
          {/* FINAL COURSE ASSESSMENT BLOCK (Course Level)                             */}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-r from-amber-50/70 to-indigo-50/70 p-6 rounded-2xl border border-amber-200 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white border border-amber-300 text-amber-600 shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Course Level Graduation
                  </span>
                  <h3 className="text-base font-bold text-charcoal">Final Course Certification Assessment</h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {course?.final_quiz ? (
                  <div className="flex items-center gap-2">
                    <Link to={`/instructor/quizzes/${course.final_quiz.id}/edit`}>
                      <Button size="sm" variant="outline" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                        View / Edit
                      </Button>
                    </Link>
                    <Link to={`/instructor/courses/${courseId}/ai-generate?target=FINAL`}>
                      <Button size="sm" variant="outline" leftIcon={<Sparkles className="w-3.5 h-3.5 text-primary" />}>
                        Generate AI
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 border-rose-200 hover:bg-rose-50"
                      onClick={() => {
                        if (course?.final_quiz && window.confirm("Delete this quiz?\n\nThis will remove the quiz and its questions. This action cannot be undone.")) {
                          deleteQuizMutation.mutate(course.final_quiz.id);
                        }
                      }}
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Delete Exam
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setQuizTargetType('FINAL');
                        setQuizTargetId(courseId!);
                        setQuizTitle(`${course?.title} Final Certification Exam`);
                        setQuizPassingScore(75);
                        setQuizMaxAttempts(3);
                        setIsQuizModalOpen(true);
                      }}
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Create Final Assessment Manually
                    </Button>
                    <Link to={`/instructor/courses/${courseId}/ai-generate?target=FINAL`}>
                      <Button size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
                        Generate Final Assessment with AI
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {course?.final_quiz ? (
              <div className="flex items-center justify-between text-xs text-charcoal bg-white/80 p-3.5 rounded-xl border border-amber-200">
                <div>
                  <span className="font-bold text-charcoal">{course.final_quiz.title}</span>
                  <div className="flex items-center gap-3 text-charcoal-muted mt-0.5 text-[11px]">
                    <span>{course.final_quiz.questions_count || 0} Questions</span>
                    <span>•</span>
                    <span>Passing Score: {course.final_quiz.passing_score}%</span>
                    <span>•</span>
                    <span>Max Attempts: {course.final_quiz.max_attempts}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Active Exam
                </span>
              </div>
            ) : (
              <p className="text-xs text-charcoal-muted">
                The Final Course Assessment tests comprehensive mastery across all modules before issuing a verified certificate.
              </p>
            )}
          </div>
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

      {/* Manual Create Quiz Modal */}
      <Modal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        title={`Configure ${quizTargetType === 'FINAL' ? 'Final Course Exam' : 'Module Checkpoint'}`}
        description="Set assessment parameters, passing criteria, and attempt rules."
      >
        <div className="space-y-4">
          <Input
            label="Assessment Title"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Passing Score (%)"
              type="number"
              value={quizPassingScore}
              onChange={(e) => setQuizPassingScore(Number(e.target.value))}
            />
            <Input
              label="Max Attempts per Cycle"
              type="number"
              value={quizMaxAttempts}
              onChange={(e) => setQuizMaxAttempts(Number(e.target.value))}
            />
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsQuizModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createQuizMutation.mutate()}
              isLoading={createQuizMutation.isPending}
              disabled={!quizTitle.trim()}
            >
              Create Assessment Checkpoint
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
