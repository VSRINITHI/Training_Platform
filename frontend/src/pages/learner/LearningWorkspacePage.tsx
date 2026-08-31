import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle2,
  Lock,
  PlayCircle,
  Award,
  FileText,
  Video,
  ArrowRight,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { lessonsApi } from '../../api/lessons';
import { progressApi } from '../../api/progress';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LessonItem, ModuleDetail } from '../../types';

export const LearningWorkspacePage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // 1. Fetch Course details (with modules & lessons)
  const { data: course, isLoading: loadingCourse } = useQuery({
    queryKey: ['course-workspace', courseId],
    queryFn: () => coursesApi.get(courseId!),
    enabled: Boolean(courseId),
  });

  // 2. Fetch Hierarchy Progress
  const { data: progressData, isLoading: loadingProgress, refetch: refetchProgress } = useQuery({
    queryKey: ['course-progress-hierarchy', courseId],
    queryFn: () => progressApi.getCourseProgress(courseId!),
    enabled: Boolean(courseId),
  });

  // 3. Fetch active lesson detail
  const { data: activeLesson, isLoading: loadingLesson } = useQuery({
    queryKey: ['lesson-detail', activeLessonId],
    queryFn: () => lessonsApi.get(activeLessonId!),
    enabled: Boolean(activeLessonId),
  });

  // Auto-select first available lesson on load
  useEffect(() => {
    if (!activeLessonId && course?.modules && course.modules.length > 0) {
      const firstModule = course.modules[0];
      if (firstModule.lessons && firstModule.lessons.length > 0) {
        setActiveLessonId(firstModule.lessons[0].id);
      }
    }
  }, [course, activeLessonId]);

  // Mark Lesson Complete Mutation
  const markLessonMutation = useMutation({
    mutationFn: (lessonId: string) => lessonsApi.markProgress(lessonId, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-progress-hierarchy', courseId] });
      success('Lesson Completed!', 'Your progress has been saved.');

      // Auto-advance to next lesson if available
      findAndSelectNextLesson();
    },
    onError: (err: any) => {
      toastError('Failed to record progress', err.message);
    },
  });

  // Reset relearning mutation
  const resetRelearningMutation = useMutation({
    mutationFn: (moduleId: string) => progressApi.resetRelearning(moduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-progress-hierarchy', courseId] });
      success('Relearning Reset', 'Module lessons are reset for relearning review.');
    },
    onError: (err: any) => {
      toastError('Reset Failed', err.message);
    },
  });

  const findAndSelectNextLesson = () => {
    if (!course?.modules) return;
    let foundCurrent = false;
    for (const mod of course.modules) {
      for (const les of mod.lessons || []) {
        if (foundCurrent) {
          setActiveLessonId(les.id);
          return;
        }
        if (les.id === activeLessonId) {
          foundCurrent = true;
        }
      }
    }
  };

  if (loadingCourse || loadingProgress) {
    return <LoadingState message="Opening learning workspace..." className="py-24" />;
  }

  if (!course) {
    return (
      <ErrorState
        title="Course Not Found"
        message="Unable to access learning workspace for this course."
      />
    );
  }

  const modules = course.modules || [];
  const progressModules = progressData?.modules || [];
  const progressModuleMap = new Map(progressModules.map((pm) => [pm.module_id, pm]));

  // Build completed lessons set
  const completedLessonIds = new Set<string>();
  progressModules.forEach((pm) => {
    pm.lesson_progress_records?.forEach((rec) => {
      if (rec.is_completed) completedLessonIds.add(rec.lesson_id);
    });
  });

  const isCurrentLessonCompleted = activeLessonId ? completedLessonIds.has(activeLessonId) : false;

  return (
    <div className="flex flex-col lg:flex-row gap-6 -mt-2">
      {/* Mobile Drawer Trigger Bar */}
      <div className="lg:hidden flex items-center justify-between bg-white p-4 rounded-xl border border-border shadow-sm">
        <div>
          <p className="text-xs font-semibold text-charcoal-muted">Curriculum Navigation</p>
          <p className="text-sm font-bold text-charcoal truncate max-w-xs">{activeLesson?.title || course.title}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMobileDrawerOpen(true)}
          leftIcon={<Menu className="w-4 h-4" />}
        >
          Curriculum
        </Button>
      </div>

      {/* Curriculum Sidebar (Desktop + Mobile Drawer) */}
      <div
        className={`lg:w-80 shrink-0 ${
          mobileDrawerOpen
            ? 'fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-start'
            : 'hidden lg:block'
        }`}
        onClick={() => setMobileDrawerOpen(false)}
      >
        <div
          className={`bg-white rounded-2xl border border-border shadow-card p-4 flex flex-col max-h-[85vh] overflow-hidden ${
            mobileDrawerOpen ? 'w-80 h-full' : 'w-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header & Overall Progress */}
          <div className="pb-3 border-b border-border/80 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">Course Progress</span>
              {mobileDrawerOpen && (
                <button onClick={() => setMobileDrawerOpen(false)} className="lg:hidden p-1 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="text-charcoal truncate max-w-[180px]">{course.title}</span>
              <span className="text-primary">{Math.round(progressData?.progress_pct || 0)}%</span>
            </div>
            <ProgressBar value={progressData?.progress_pct || 0} size="sm" />
          </div>

          {/* Module & Lesson List */}
          <div className="overflow-y-auto pt-3 space-y-4 flex-1 pr-1">
            {modules.map((module, mIdx) => {
              const pm = progressModuleMap.get(module.id);
              const isLocked = pm ? !pm.is_unlocked : mIdx > 0;
              const isRelearning = pm?.status === 'NEEDS_RELEARNING';
              const isCompleted = pm?.status === 'COMPLETED';

              return (
                <div key={module.id} className="space-y-1.5">
                  <div className="flex items-center justify-between px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-primary">M{mIdx + 1}</span>
                      <span className="text-xs font-bold text-charcoal line-clamp-1">{module.title}</span>
                    </div>
                    {isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    ) : isRelearning ? (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        Relearning
                      </span>
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : null}
                  </div>

                  {/* Lessons */}
                  <div className="space-y-1 pl-2">
                    {module.lessons?.map((les) => {
                      const isLesCompleted = completedLessonIds.has(les.id);
                      const isActive = activeLessonId === les.id;

                      return (
                        <button
                          key={les.id}
                          disabled={isLocked}
                          onClick={() => {
                            setActiveLessonId(les.id);
                            setMobileDrawerOpen(false);
                          }}
                          className={`flex items-center justify-between w-full p-2 rounded-lg text-xs font-medium text-left transition-all ${
                            isActive
                              ? 'bg-primary text-white font-semibold shadow-sm'
                              : isLocked
                              ? 'opacity-50 cursor-not-allowed text-slate-400'
                              : 'text-charcoal hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isLesCompleted ? (
                              <CheckCircle2
                                className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-emerald-500'}`}
                              />
                            ) : (
                              <PlayCircle
                                className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                              />
                            )}
                            <span className="truncate">{les.title}</span>
                          </div>
                          {les.duration_minutes && (
                            <span className={`text-[10px] shrink-0 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                              {les.duration_minutes}m
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* Needs Relearning Action Button */}
                    {isRelearning && (
                      <button
                        type="button"
                        onClick={() => resetRelearningMutation.mutate(module.id)}
                        disabled={resetRelearningMutation.isPending}
                        className="flex items-center gap-1.5 w-full p-2 mt-1 rounded-lg text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                      >
                        <RotateCcw className="w-3.5 h-3.5 animate-spin-hover" />
                        <span>Reset Lessons for Relearning</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Final Exam Section */}
            <div className="pt-3 border-t border-border/80 px-2 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-charcoal">
                <span className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Final Certification</span>
                </span>
                {progressData?.is_final_exam_unlocked ? (
                  <span className="text-[10px] text-emerald-600 font-semibold">Unlocked</span>
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
              <p className="text-[11px] text-charcoal-muted">
                Complete all required module assessments to unlock the final certification exam.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Lesson Workspace */}
      <div className="flex-1 bg-white rounded-2xl border border-border shadow-card p-6 sm:p-8 flex flex-col min-h-[600px] justify-between space-y-6">
        {loadingLesson ? (
          <LoadingState message="Loading lesson materials..." className="my-auto" />
        ) : !activeLesson ? (
          <div className="text-center my-auto space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-charcoal">Select a Lesson to Begin</h3>
            <p className="text-xs text-charcoal-muted">Choose a lesson from the curriculum sidebar.</p>
          </div>
        ) : (
          <>
            {/* Lesson Title and Meta */}
            <div className="border-b border-border/80 pb-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-primary font-semibold">
                  <BookOpen className="w-4 h-4" />
                  <span>Interactive Lesson</span>
                </div>
                {isCurrentLessonCompleted && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-charcoal tracking-tight">
                {activeLesson.title}
              </h2>
            </div>

            {/* Video Player if video_url is present */}
            {activeLesson.video_url && (
              <div className="bg-slate-900 rounded-xl p-4 text-white flex flex-col items-center justify-center min-h-[220px]">
                <Video className="w-10 h-10 text-primary-light mb-2" />
                <p className="text-sm font-semibold">Video Lecture Available</p>
                <a
                  href={activeLesson.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-xs text-primary-light hover:underline flex items-center gap-1"
                >
                  Watch Lecture Resource <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Document link if document_url is present */}
            {activeLesson.document_url && (
              <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-primary font-medium">
                  <FileText className="w-4 h-4" />
                  <span>Supplementary Study Documentation</span>
                </div>
                <a
                  href={activeLesson.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Open Document
                </a>
              </div>
            )}

            {/* Content Body */}
            <div className="prose max-w-none text-sm sm:text-base text-charcoal leading-relaxed space-y-4 flex-1">
              {activeLesson.content_body ? (
                <div className="whitespace-pre-wrap font-sans">{activeLesson.content_body}</div>
              ) : (
                <p className="text-charcoal-muted italic">No written notes provided for this lesson.</p>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-charcoal-muted">
                {isCurrentLessonCompleted
                  ? '✓ Progress saved. You may revisit this content anytime.'
                  : 'Click below once you have reviewed the lesson materials.'}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  isLoading={markLessonMutation.isPending}
                  onClick={() => markLessonMutation.mutate(activeLesson.id)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {isCurrentLessonCompleted ? 'Next Lesson' : 'Mark Complete & Continue'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
