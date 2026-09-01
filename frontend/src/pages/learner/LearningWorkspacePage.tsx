import React, { useState, useEffect, useMemo } from 'react';
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
  Edit3,
  Trash2,
  Copy,
  Check,
  Info,
  PanelRightClose,
  PanelRightOpen,
  StickyNote,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { lessonsApi } from '../../api/lessons';
import { progressApi } from '../../api/progress';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LessonItem, ModuleDetail } from '../../types';

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

  // Note State
  const [noteContent, setNoteContent] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 1. Fetch Course details (with modules & lessons)
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
      // Invalidate all related progress cache keys
      queryClient.invalidateQueries({ queryKey: ['course-progress-hierarchy', courseId] });
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['recommended-courses'] });
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

  // Granular lesson-level progress calculation
  const allLessons = modules.flatMap((m) => m.lessons || []);
  const totalLessonsCount = allLessons.length;
  const completedLessonsCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;

  const dynamicProgressPct =
    progressData?.is_course_completed || progressData?.status === 'COMPLETED'
      ? 100
      : totalLessonsCount > 0
      ? Math.round((completedLessonsCount / totalLessonsCount) * 100)
      : Math.round(progressData?.progress_pct || 0);

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
          Curriculum
        </Button>

        {/* Mobile View Mode Switcher */}
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
        {/* COLUMN 1: Curriculum Sidebar (Desktop & Mobile Drawer)                     */}
        {/* ========================================================================= */}
        <div
          className={`lg:col-span-3 ${
            mobileCurriculumOpen
              ? 'fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-start'
              : 'hidden lg:block'
          }`}
          onClick={() => setMobileCurriculumOpen(false)}
        >
          <div
            className={`bg-white rounded-2xl border border-border shadow-card p-4 flex flex-col max-h-[85vh] overflow-hidden ${
              mobileCurriculumOpen ? 'w-80 h-full' : 'w-full'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header & Dynamic Progress */}
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
                <span className="text-charcoal truncate max-w-[180px]">{course.title}</span>
                <span className="text-primary font-bold">{dynamicProgressPct}%</span>
              </div>
              <ProgressBar value={dynamicProgressPct} size="sm" />
              <p className="text-[10px] text-charcoal-muted mt-1.5 flex items-center justify-between">
                <span>{completedLessonsCount} of {totalLessonsCount} lessons finished</span>
                {progressData?.is_course_completed && (
                  <span className="text-emerald-600 font-bold">Graduated</span>
                )}
              </p>
            </div>

            {/* Modules and Lessons Tree */}
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
                              setMobileCurriculumOpen(false);
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

                      {/* Relearning Action */}
                      {isRelearning && (
                        <button
                          type="button"
                          onClick={() => resetRelearningMutation.mutate(module.id)}
                          disabled={resetRelearningMutation.isPending}
                          className="flex items-center gap-1.5 w-full p-2 mt-1 rounded-lg text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
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
                  Complete all modules to unlock the final certification exam.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: Main Lesson Workspace                                           */}
        {/* ========================================================================= */}
        <div
          className={`${
            showDesktopNotes ? 'lg:col-span-6' : 'lg:col-span-9'
          } ${mobileActiveTab === 'notes' ? 'hidden lg:block' : 'block'} bg-white rounded-2xl border border-border shadow-card p-6 sm:p-8 flex flex-col min-h-[620px] justify-between space-y-6`}
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
                    {/* Toggle Desktop Notes Panel */}
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

              {/* Video Player if video_url is present */}
              {activeLesson.video_url && (
                <div className="bg-slate-900 rounded-xl p-5 text-white flex flex-col items-center justify-center min-h-[220px]">
                  <Video className="w-10 h-10 text-primary-light mb-2" />
                  <p className="text-sm font-semibold">Video Lecture Resource</p>
                  <a
                    href={activeLesson.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 text-xs text-primary-light hover:underline flex items-center gap-1"
                  >
                    Open Lecture Stream <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Document Link */}
              {activeLesson.document_url && (
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-primary font-medium">
                    <FileText className="w-4 h-4" />
                    <span>Supplementary Study Materials</span>
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
                  <p className="text-charcoal-muted italic">No written lesson materials provided.</p>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-charcoal-muted">
                  {isCurrentLessonCompleted
                    ? '✓ Progress saved. You can revisit this lesson anytime.'
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

        {/* ========================================================================= */}
        {/* COLUMN 3: My Notes / Notepad (Desktop 3rd Column & Mobile Tab)            */}
        {/* ========================================================================= */}
        {(showDesktopNotes || mobileActiveTab === 'notes') && (
          <div
            className={`lg:col-span-3 ${
              mobileActiveTab === 'notes' ? 'block' : 'hidden lg:block'
            } bg-white rounded-2xl border border-border shadow-card p-5 flex flex-col h-full min-h-[620px] justify-between space-y-4`}
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
                  {noteContent && (
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
                  )}
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
                className="w-full flex-1 min-h-[360px] p-3 text-xs leading-relaxed text-charcoal bg-slate-50/70 rounded-xl border border-border focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-none font-sans"
              />

              <div className="flex items-center justify-between text-[10px] text-charcoal-muted px-1">
                <span>{noteContent ? `${noteContent.length} characters` : 'Empty note'}</span>
                {lastSaved && <span>Saved at {lastSaved}</span>}
              </div>
            </div>

            {/* Offline/Local Storage Notice */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-[11px] text-charcoal-muted">
              <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                <Info className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span>Local Device Storage</span>
              </div>
              <p className="text-[10px] leading-normal text-slate-500">
                Notes saved locally on this device. Cloud synchronization is not currently available.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
