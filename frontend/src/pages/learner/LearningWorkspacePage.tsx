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
  RotateCcw,
  Sparkles,
  Trash2,
  Copy,
  Check,
  Info,
  PanelRightClose,
  PanelRightOpen,
  StickyNote,
  HelpCircle,
  Download,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { lessonsApi } from '../../api/lessons';
import { progressApi } from '../../api/progress';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';

export const LearningWorkspacePage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [mobileCurriculumOpen, setMobileCurriculumOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'content' | 'notes'>('content');
  const [showDesktopNotes, setShowDesktopNotes] = useState(true);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // Note State
  const [noteContent, setNoteContent] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 1. Fetch Course details
  const { data: course, isLoading: loadingCourse } = useQuery({
    queryKey: ['course-workspace', courseId],
    queryFn: () => coursesApi.get(courseId!),
    enabled: Boolean(courseId),
  });

  // 2. Fetch Hierarchy Progress
  const { data: progressData, isLoading: loadingProgress } = useQuery({
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

  // Load lesson notes from local storage when active lesson changes
  useEffect(() => {
    if (!activeLessonId) return;
    const storageKey = `datacaliper_notes_${user?.id || 'anonymous'}_${activeLessonId}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNoteContent(parsed.content || '');
        setLastSaved(parsed.updatedAt || null);
      } catch {
        setNoteContent(saved);
        setLastSaved(null);
      }
    } else {
      setNoteContent('');
      setLastSaved(null);
    }
  }, [activeLessonId, user?.id]);

  // Save notes locally
  const handleSaveNote = (newContent: string) => {
    setNoteContent(newContent);
    if (!activeLessonId) return;
    const storageKey = `datacaliper_notes_${user?.id || 'anonymous'}_${activeLessonId}`;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem(
      storageKey,
      JSON.stringify({ content: newContent, updatedAt: now })
    );
    setLastSaved(now);
  };

  const handleClearNotes = () => {
    if (!activeLessonId) return;
    const storageKey = `datacaliper_notes_${user?.id || 'anonymous'}_${activeLessonId}`;
    localStorage.removeItem(storageKey);
    setNoteContent('');
    setLastSaved(null);
    success('Notes Cleared', 'Your notes for this lesson have been reset.');
  };

  const handleCopyNotes = () => {
    if (!noteContent) return;
    navigator.clipboard.writeText(noteContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    success('Copied to Clipboard', 'Your notes have been copied.');
  };

  // Mark Lesson Complete Mutation
  const markLessonMutation = useMutation({
    mutationFn: (lessonId: string) => lessonsApi.markProgress(lessonId, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-progress-hierarchy', courseId] });
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['course-workspace', courseId] });
      success('Lesson Completed!', 'Your progress has been recorded.');
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
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      success('Module Reset for Relearning', 'Module lessons are ready for review.');
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

  const allLessons = modules.flatMap((m) => m.lessons || []);
  const totalLessonsCount = allLessons.length;
  const completedLessonsCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;

  const dynamicProgressPct =
    progressData?.is_course_completed || progressData?.status === 'COMPLETED'
      ? 100
      : Math.round(Number(progressData?.progress_pct || 0));

  const isCurrentLessonCompleted = activeLessonId ? completedLessonIds.has(activeLessonId) : false;

  return (
    <div className="space-y-4 -mt-2">
      {/* Top Mobile Control Bar */}
      <div className="lg:hidden bg-white p-3 rounded-xl border border-border shadow-sm flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMobileCurriculumOpen(true)}
          leftIcon={<Menu className="w-4 h-4" />}
        >
          Curriculum Tree
        </Button>

        <div className="flex bg-slate-100 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setMobileActiveTab('content')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              mobileActiveTab === 'content'
                ? 'bg-white text-primary shadow-sm'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            Lesson
          </button>
          <button
            type="button"
            onClick={() => setMobileActiveTab('notes')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
              mobileActiveTab === 'notes'
                ? 'bg-white text-primary shadow-sm'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>Notes</span>
          </button>
        </div>
      </div>

      {/* 3-Column Desktop Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* COLUMN 1: Curriculum & Module Quiz Sidebar                                 */}
        {/* ========================================================================= */}
        <div
          className={`lg:col-span-4 ${
            mobileCurriculumOpen
              ? 'fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-start'
              : 'hidden lg:block'
          }`}
          onClick={() => setMobileCurriculumOpen(false)}
        >
          <div
            className={`bg-white rounded-2xl border border-border shadow-card p-4 flex flex-col max-h-[88vh] overflow-hidden ${
              mobileCurriculumOpen ? 'w-84 h-full' : 'w-full'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header & Dynamic Course Progress */}
            <div className="pb-3 border-b border-border/80 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">
                  Course Progress
                </span>
                {mobileCurriculumOpen && (
                  <button onClick={() => setMobileCurriculumOpen(false)} className="lg:hidden p-1 text-slate-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="text-charcoal truncate max-w-[200px]">{course.title}</span>
                <span className="text-primary font-bold">{dynamicProgressPct}%</span>
              </div>
              <ProgressBar value={dynamicProgressPct} size="sm" />
              <p className="text-[10px] text-charcoal-muted mt-1.5 flex items-center justify-between">
                <span>{completedLessonsCount} of {totalLessonsCount} lessons finished</span>
                {progressData?.is_course_completed && (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> Certified
                  </span>
                )}
              </p>
            </div>

            {/* Modules, Lessons & Module Quizzes Tree */}
            <div className="overflow-y-auto pt-3 space-y-4 flex-1 pr-1">
              {modules.map((module, mIdx) => {
                const pm = progressModuleMap.get(module.id);
                const isLocked = pm ? !pm.is_unlocked : mIdx > 0;
                const isRelearning = pm?.status === 'NEEDS_RELEARNING';
                const isCompleted = pm?.status === 'COMPLETED';
                const modLessons = module.lessons || [];
                const allModLessonsCompleted =
                  modLessons.length > 0 &&
                  modLessons.every((l) => completedLessonIds.has(l.id));

                return (
                  <div key={module.id} className="space-y-2 bg-slate-50/60 p-2.5 rounded-xl border border-slate-200/80">
                    {/* Module Title & Status */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-primary">M{mIdx + 1}</span>
                        <span className="text-xs font-bold text-charcoal line-clamp-1">{module.title}</span>
                      </div>
                      {isLocked ? (
                        <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : isRelearning ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          Relearning (0%)
                        </span>
                      ) : isCompleted ? (
                        <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-primary">In Progress</span>
                      )}
                    </div>

                    {/* Lessons List */}
                    <div className="space-y-1 pl-1">
                      {modLessons.map((les) => {
                        const isLesCompleted = completedLessonIds.has(les.id);
                        const isActive = activeLessonId === les.id;

                        return (
                          <button
                            key={les.id}
                            disabled={isLocked}
                            onClick={() => {
                              setActiveLessonId(les.id);
                              setMobileCurriculumOpen(false);
                            }}
                            className={`flex items-center justify-between w-full p-2 rounded-lg text-xs font-medium text-left transition-all ${
                              isActive
                                ? 'bg-primary text-white font-semibold shadow-sm'
                                : isLocked
                                ? 'opacity-50 cursor-not-allowed text-slate-400'
                                : 'text-charcoal hover:bg-white bg-slate-50'
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
                            {les.duration_minutes ? (
                              <span className={`text-[10px] shrink-0 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                                {les.duration_minutes}m
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {/* ========================================================================= */}
                    {/* MODULE QUIZ CHECKPOINT (Required for Module Completion)                   */}
                    {/* ========================================================================= */}
                    {pm?.quiz_id && (
                      <div className="pt-2 border-t border-slate-200/80 px-1">
                        {isLocked ? (
                          <div className="p-2 rounded-lg bg-slate-100 text-slate-400 text-[11px] flex items-center justify-between">
                            <span className="flex items-center gap-1.5 truncate">
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Module {mIdx + 1} Quiz</span>
                            </span>
                            <span className="text-[10px]">Locked</span>
                          </div>
                        ) : !allModLessonsCompleted && !isCompleted ? (
                          <div className="p-2 rounded-lg bg-indigo-50/50 border border-indigo-100 text-slate-500 text-[11px] space-y-1">
                            <div className="flex items-center gap-1.5 font-semibold text-primary">
                              <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span>Module {mIdx + 1} Assessment</span>
                            </div>
                            <p className="text-[10px] text-charcoal-muted">
                              Complete all required module lessons to unlock this quiz.
                            </p>
                          </div>
                        ) : isCompleted ? (
                          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="font-bold">Module Assessment Passed</span>
                            </div>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                              Passed (100%)
                            </span>
                          </div>
                        ) : isRelearning ? (
                          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-[11px] space-y-2">
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold block">2 Failed Attempts • Progress Reset</span>
                                <span className="text-[10px] text-rose-700 leading-tight block mt-0.5">
                                  You did not pass after 2 attempts. Review the module lessons and restart.
                                </span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full bg-white text-rose-700 border-rose-300 hover:bg-rose-100"
                              isLoading={resetRelearningMutation.isPending}
                              onClick={() => resetRelearningMutation.mutate(module.id)}
                              leftIcon={<RotateCcw className="w-3 h-3" />}
                            >
                              Reset Lessons & Start New Cycle
                            </Button>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-primary text-[11px] space-y-1.5">
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                <span>Module {mIdx + 1} Quiz Ready</span>
                              </span>
                              <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                {pm.quiz_attempts_remaining} Attempt{pm.quiz_attempts_remaining !== 1 ? 's' : ''} Left
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-charcoal-muted">
                              <span>Passing: {pm.quiz_passing_score || 70}%</span>
                              <span>Max Attempts: 2</span>
                            </div>
                            <Link to={`/learner/quiz/${pm.quiz_id}`} className="block mt-1">
                              <Button size="sm" className="w-full" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                                {pm.attempts_used > 0 ? 'Retry Module Quiz' : 'Start Module Quiz'}
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ========================================================================= */}
              {/* FINAL COURSE ASSESSMENT SECTION                                           */}
              {/* ========================================================================= */}
              <div className="pt-3 border-t border-border/80 px-2 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-charcoal">
                  <span className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>Final Course Assessment</span>
                  </span>
                  {progressData?.is_final_exam_unlocked ? (
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Unlocked
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-charcoal-muted leading-relaxed">
                  {progressData?.is_final_exam_unlocked
                    ? 'All modules completed! Pass the final assessment to earn your official certificate.'
                    : 'Complete all required modules and pass every module quiz to unlock the final certification exam.'}
                </p>

                {progressData?.is_final_exam_unlocked && progressData?.final_exam_quiz_id && (
                  <Link to={`/learner/quiz/${progressData.final_exam_quiz_id}`} className="block pt-1">
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm"
                      rightIcon={<Award className="w-4 h-4" />}
                    >
                      {progressData.is_course_completed ? 'Review Final Exam' : 'Take Final Certification Exam'}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: Main Lesson Workspace (In-Platform Video & Documents)            */}
        {/* ========================================================================= */}
        <div
          className={`${
            showDesktopNotes ? 'lg:col-span-5' : 'lg:col-span-8'
          } ${mobileActiveTab === 'notes' ? 'hidden lg:block' : 'block'} bg-white rounded-2xl border border-border shadow-card p-6 sm:p-8 flex flex-col min-h-[660px] justify-between space-y-6`}
        >
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
              {/* Lesson Title and Header Action */}
              <div className="border-b border-border/80 pb-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-primary font-semibold">
                    <BookOpen className="w-4 h-4" />
                    <span>Interactive Lesson</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrentLessonCompleted && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowDesktopNotes(!showDesktopNotes)}
                      className="hidden lg:flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-border text-charcoal-muted hover:text-charcoal hover:bg-slate-50 transition-colors"
                      title={showDesktopNotes ? 'Hide Notes Panel' : 'Show Notes Panel'}
                    >
                      {showDesktopNotes ? (
                        <>
                          <PanelRightClose className="w-3.5 h-3.5" />
                          <span>Hide Notes</span>
                        </>
                      ) : (
                        <>
                          <PanelRightOpen className="w-3.5 h-3.5 text-primary" />
                          <span className="text-primary">Open Notes</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-charcoal tracking-tight">
                  {activeLesson.title}
                </h2>
              </div>

              {/* =================================================================== */}
              {/* IN-PLATFORM VIDEO PLAYER (No YouTube or external redirects)         */}
              {/* =================================================================== */}
              {activeLesson.video_url ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-charcoal">
                    <Video className="w-4 h-4 text-primary" />
                    <span>Lecture Video</span>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-lg">
                    <video
                      key={activeLesson.video_url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full max-h-[380px] bg-black"
                      src={activeLesson.video_url}
                      onError={(e) => {
                        console.warn("Video playback error on src:", activeLesson.video_url, e);
                      }}
                    >
                      <source src={activeLesson.video_url} type="video/mp4" />
                      Your browser does not support the HTML5 video tag.
                    </video>
                  </div>
                </div>
              ) : null}

              {/* =================================================================== */}
              {/* IN-PLATFORM LEARNING MATERIALS (Automatic Embedded PDF & Documents) */}
              {/* =================================================================== */}
              {activeLesson.document_url ? (
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-emerald-200/70">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-charcoal block">
                          Supplementary Study Material
                        </span>
                        <span className="text-[11px] text-charcoal-muted truncate max-w-xs block font-mono">
                          {activeLesson.document_url.split('/').pop() || 'Study Material Document'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={activeLesson.document_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Document</span>
                      </a>
                    </div>
                  </div>

                  {/* Automatic Embedded PDF Viewer */}
                  {activeLesson.document_url.toLowerCase().endsWith('.pdf') ? (
                    <div className="rounded-xl overflow-hidden border border-emerald-200 bg-white shadow-inner">
                      <iframe
                        key={activeLesson.document_url}
                        src={`${activeLesson.document_url}#toolbar=0&navpanes=0`}
                        title="Embedded Supplementary Study Material"
                        className="w-full h-[520px] rounded-xl"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Lesson Body / Notes Content */}
              <div className="prose max-w-none text-sm sm:text-base text-charcoal leading-relaxed space-y-4 flex-1">
                {activeLesson.content_body ? (
                  <div className="whitespace-pre-wrap font-sans">{activeLesson.content_body}</div>
                ) : (
                  <p className="text-charcoal-muted italic">No written lesson materials provided.</p>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-charcoal-muted">
                  {isCurrentLessonCompleted
                    ? '✓ Lesson completed. You can review anytime.'
                    : 'Review the lecture materials and mark complete to progress.'}
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

        {/* ========================================================================= */}
        {/* COLUMN 3: My Notes / Notepad (Desktop 3rd Column & Mobile Tab)            */}
        {/* ========================================================================= */}
        {(showDesktopNotes || mobileActiveTab === 'notes') && (
          <div
            className={`lg:col-span-3 ${
              mobileActiveTab === 'notes' ? 'block' : 'hidden lg:block'
            } bg-white rounded-2xl border border-border shadow-card p-5 flex flex-col h-full min-h-[660px] justify-between space-y-4`}
          >
            {/* Notes Header */}
            <div className="pb-3 border-b border-border/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                    <StickyNote className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-charcoal">Lesson Notes</h3>
                </div>
                <div className="flex items-center gap-1">
                  {noteContent ? (
                    <>
                      <button
                        type="button"
                        onClick={handleCopyNotes}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                        title="Copy Notes"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearNotes}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                        title="Clear Notes"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <p className="text-[11px] font-semibold text-charcoal-muted truncate">
                {activeLesson ? activeLesson.title : 'Select a lesson'}
              </p>
            </div>

            {/* Notepad Textarea */}
            <div className="flex-1 flex flex-col space-y-2">
              <textarea
                value={noteContent}
                onChange={(e) => handleSaveNote(e.target.value)}
                disabled={!activeLesson}
                placeholder={
                  activeLesson
                    ? 'Write your study notes, key takeaways, and code snippets here...'
                    : 'Select a lesson to take notes.'
                }
                className="w-full flex-1 min-h-[380px] p-3 text-xs leading-relaxed text-charcoal bg-slate-50/70 rounded-xl border border-border focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-none font-sans"
              />

              <div className="flex items-center justify-between text-[10px] text-charcoal-muted px-1">
                <span>{noteContent ? `${noteContent.length} characters` : 'Empty note'}</span>
                {lastSaved && <span>Saved at {lastSaved}</span>}
              </div>
            </div>

            {/* Notice */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-[11px] text-charcoal-muted">
              <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                <Info className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span>Local Device Storage</span>
              </div>
              <p className="text-[10px] leading-normal text-slate-500">
                Notes are persisted locally on your device for quick offline revision.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* PDF In-Platform Preview Modal */}
      {pdfPreviewUrl && (
        <Modal
          isOpen={Boolean(pdfPreviewUrl)}
          onClose={() => setPdfPreviewUrl(null)}
          size="lg"
          title="Document Viewer (PDF)"
        >
          <div className="space-y-4">
            <div className="w-full h-[65vh] rounded-xl overflow-hidden border border-border bg-slate-100">
              <iframe
                src={pdfPreviewUrl}
                title="PDF Document Preview"
                className="w-full h-full border-none"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-charcoal-muted truncate max-w-sm font-mono">
                {pdfPreviewUrl}
              </span>
              <a
                href={pdfPreviewUrl}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
