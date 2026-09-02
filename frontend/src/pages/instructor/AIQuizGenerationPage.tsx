import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  ArrowLeft,
  Cpu,
  CheckCircle2,
  FileText,
  FileCheck,
  Video,
  AlertCircle,
  HelpCircle,
  Layers,
  Award,
  RefreshCw,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { modulesApi } from '../../api/modules';
import { lessonsApi } from '../../api/lessons';
import { aiDraftsApi } from '../../api/aiDrafts';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { LoadingState } from '../../components/ui/LoadingState';
import { QuestionType, Course, ModuleDetail, LessonItem, AIQuizDraft } from '../../types';

export const AIQuizGenerationPage: React.FC = () => {
  const { courseId: paramCourseId, moduleId: paramModuleId, lessonId: paramLessonId } = useParams<{
    courseId?: string;
    moduleId?: string;
    lessonId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const queryModuleId = searchParams.get('moduleId');
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  // If accessed via lessonId, fetch lesson to find parent course/module
  const { data: routeLesson } = useQuery({
    queryKey: ['route-lesson', paramLessonId],
    queryFn: () => lessonsApi.get(paramLessonId!),
    enabled: Boolean(paramLessonId),
  });

  // Effective courseId and moduleId
  const [resolvedCourseId, setResolvedCourseId] = useState<string | null>(paramCourseId || null);

  // Target assessment level: 'MODULE' or 'FINAL'
  const [targetType, setTargetType] = useState<'MODULE' | 'FINAL'>(
    searchParams.get('target') === 'FINAL' ? 'FINAL' : 'MODULE'
  );
  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    paramModuleId || queryModuleId || ''
  );
  const [selectedModuleIdsForFinal, setSelectedModuleIdsForFinal] = useState<string[]>([]);

  // Source selection state: specific lessons and documents checked
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [selectedDocUrls, setSelectedDocUrls] = useState<string[]>([]);

  // AI Configuration Form State
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('INTERMEDIATE');
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(['MCQ', 'TRUE_FALSE', 'MULTI_SELECT']);
  const [customInstructions, setCustomInstructions] = useState<string>('');

  // Fetch course details if courseId is known
  const { data: course, isLoading: loadingCourse } = useQuery({
    queryKey: ['course-ai-gen', resolvedCourseId],
    queryFn: () => coursesApi.get(resolvedCourseId!),
    enabled: Boolean(resolvedCourseId),
  });

  // Update resolvedCourseId from route lesson if applicable
  useEffect(() => {
    if (routeLesson?.module_id && !resolvedCourseId) {
      // Find course via module
      modulesApi.get(routeLesson.module_id).then((m) => {
        if (m?.course_id) {
          setResolvedCourseId(m.course_id);
          setSelectedModuleId(m.id);
        }
      });
    }
  }, [routeLesson, resolvedCourseId]);

  // If accessed directly via moduleId
  useEffect(() => {
    if (paramModuleId && !resolvedCourseId) {
      modulesApi.get(paramModuleId).then((m) => {
        if (m?.course_id) {
          setResolvedCourseId(m.course_id);
          setSelectedModuleId(m.id);
        }
      });
    }
  }, [paramModuleId, resolvedCourseId]);

  // Default target selection when course loads
  useEffect(() => {
    if (course?.modules && course.modules.length > 0) {
      if (!selectedModuleId) {
        setSelectedModuleId(course.modules[0].id);
      }
      if (selectedModuleIdsForFinal.length === 0) {
        setSelectedModuleIdsForFinal(course.modules.map((m) => m.id));
      }
    }
  }, [course, selectedModuleId, selectedModuleIdsForFinal.length]);

  // Available lessons and documents based on target selection
  const relevantModules: ModuleDetail[] = useMemo(() => {
    if (!course?.modules) return [];
    if (targetType === 'MODULE') {
      const mod = course.modules.find((m) => m.id === selectedModuleId);
      return mod ? [mod] : [];
    } else {
      return course.modules.filter((m) => selectedModuleIdsForFinal.includes(m.id));
    }
  }, [course, targetType, selectedModuleId, selectedModuleIdsForFinal]);

  const allRelevantLessons: LessonItem[] = useMemo(() => {
    return relevantModules.flatMap((m) => m.lessons || []);
  }, [relevantModules]);

  // Auto-select all available lessons and documents when module target changes
  useEffect(() => {
    if (allRelevantLessons.length > 0) {
      setSelectedLessonIds(allRelevantLessons.map((l) => l.id));
      const docUrls = allRelevantLessons.filter((l) => Boolean(l.document_url)).map((l) => l.document_url as string);
      setSelectedDocUrls(docUrls);
    }
  }, [relevantModules, allRelevantLessons.length]);

  const toggleType = (type: QuestionType) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter((t) => t !== type));
      }
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const toggleLesson = (id: string) => {
    if (selectedLessonIds.includes(id)) {
      setSelectedLessonIds(selectedLessonIds.filter((lId) => lId !== id));
    } else {
      setSelectedLessonIds([...selectedLessonIds, id]);
    }
  };

  const toggleDoc = (url: string) => {
    if (selectedDocUrls.includes(url)) {
      setSelectedDocUrls(selectedDocUrls.filter((u) => u !== url));
    } else {
      setSelectedDocUrls([...selectedDocUrls, url]);
    }
  };

  const toggleModuleForFinal = (modId: string) => {
    if (selectedModuleIdsForFinal.includes(modId)) {
      if (selectedModuleIdsForFinal.length > 1) {
        setSelectedModuleIdsForFinal(selectedModuleIdsForFinal.filter((id) => id !== modId));
      }
    } else {
      setSelectedModuleIdsForFinal([...selectedModuleIdsForFinal, modId]);
    }
  };

  const selectAllSources = () => {
    setSelectedLessonIds(allRelevantLessons.map((l) => l.id));
    setSelectedDocUrls(
      allRelevantLessons.filter((l) => Boolean(l.document_url)).map((l) => l.document_url as string)
    );
  };

  const deselectAllSources = () => {
    setSelectedLessonIds([]);
    setSelectedDocUrls([]);
  };

  // NVIDIA AI Generation Mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        num_questions: numQuestions,
        difficulty,
        question_types: selectedTypes,
        custom_instructions: customInstructions || undefined,
        lesson_ids: selectedLessonIds.length > 0 ? selectedLessonIds : undefined,
        document_urls: selectedDocUrls.length > 0 ? selectedDocUrls : undefined,
        module_ids: targetType === 'FINAL' ? selectedModuleIdsForFinal : undefined,
      };

      if (targetType === 'MODULE') {
        if (!selectedModuleId) throw new Error('Please select a target module');
        return aiDraftsApi.generateModuleQuiz(selectedModuleId, payload);
      } else {
        if (!resolvedCourseId) throw new Error('Target course identifier missing');
        return aiDraftsApi.generateCourseQuiz(resolvedCourseId, payload);
      }
    },
    onSuccess: (draft) => {
      success('AI Questions Generated!', 'Questions generated by NVIDIA Llama 3.2 and quarantined for review.');
      navigate(`/instructor/ai-drafts/${draft.id}`);
    },
    onError: async (err: any) => {
      // Check if the backend actually completed processing and saved a draft
      try {
        let existingDrafts: AIQuizDraft[] = [];
        if (targetType === 'MODULE' && selectedModuleId) {
          existingDrafts = await aiDraftsApi.listByModule(selectedModuleId);
        } else if (resolvedCourseId) {
          existingDrafts = await aiDraftsApi.listByCourse(resolvedCourseId);
        }

        const pendingDraft = existingDrafts.find((d) => d.status === 'PENDING_REVIEW');
        if (pendingDraft) {
          success('AI Draft Recovered!', 'The generated draft was successfully processed and is ready for review.');
          navigate(`/instructor/ai-drafts/${pendingDraft.id}`);
          return;
        }
      } catch (checkErr) {
        // Fall through to error toast
      }

      toastError('AI Generation Failed', err.response?.data?.detail || err.message || 'Generation error. You may retry.');
    },
  });

  if (loadingCourse) {
    return <LoadingState message="Loading curriculum context..." className="py-24" />;
  }

  const modules = course?.modules || [];
  const selectedModuleObj = modules.find((m) => m.id === selectedModuleId);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Back Navigation */}
      <div className="flex items-center gap-2 text-xs text-charcoal-muted mb-2">
        <Link
          to={resolvedCourseId ? `/instructor/courses/${resolvedCourseId}/curriculum` : '/instructor/courses'}
          className="hover:text-charcoal hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Curriculum Builder
        </Link>
      </div>

      <PageHeader
        title="Generate AI Assessment with NVIDIA Llama 3.2"
        description={`Course: ${course?.title || 'Loading...'}`}
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-primary border border-indigo-200 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" />
            NVIDIA NIM (Llama 3.2 11B Vision Instruct)
          </span>
        }
      />

      {/* Human-in-the-Loop Quarantine Alert */}
      <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 text-xs text-slate-700 flex items-start gap-3 leading-relaxed">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-primary">Human-in-the-Loop Quarantine Pipeline</p>
          <p className="mt-0.5 text-charcoal-muted">
            All AI-generated questions are quarantined with <code className="bg-white px-1.5 py-0.5 rounded text-amber-700 font-mono font-bold">PENDING_REVIEW</code> status. They remain isolated from learners until explicitly approved and imported by the instructor.
          </p>
        </div>
      </div>

      {/* Step 1: Target Assessment Selection */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-border shadow-card space-y-5">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white font-bold text-xs">1</span>
            <h3 className="text-sm font-bold text-charcoal">Select Assessment Target</h3>
          </div>
          <span className="text-[11px] text-charcoal-muted">Module Quiz or Final Exam</span>
        </div>

        {/* Assessment Level Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTargetType('MODULE')}
            className={`p-4 rounded-xl border text-left transition-all ${
              targetType === 'MODULE'
                ? 'border-primary bg-indigo-50/50 shadow-sm ring-1 ring-primary'
                : 'border-border bg-slate-50/50 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-charcoal flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                Module Quiz / Checkpoint
              </span>
              {targetType === 'MODULE' && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-[11px] text-charcoal-muted mt-1">
              Assess competency for a specific module chapter before unlocking next modules.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setTargetType('FINAL')}
            className={`p-4 rounded-xl border text-left transition-all ${
              targetType === 'FINAL'
                ? 'border-primary bg-indigo-50/50 shadow-sm ring-1 ring-primary'
                : 'border-border bg-slate-50/50 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-charcoal flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-600" />
                Final Course Assessment
              </span>
              {targetType === 'FINAL' && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-[11px] text-charcoal-muted mt-1">
              Comprehensive exam across course chapters required for certification.
            </p>
          </button>
        </div>

        {/* Target Module Dropdown or Multi-select */}
        {targetType === 'MODULE' ? (
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1.5">Target Module</label>
            <select
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-white text-charcoal focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              {modules.map((m, idx) => (
                <option key={m.id} value={m.id}>
                  Module {idx + 1}: {m.title} ({m.lessons?.length || 0} lessons)
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1.5">
              Include Modules in Final Assessment
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {modules.map((m, idx) => {
                const isChecked = selectedModuleIdsForFinal.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModuleForFinal(m.id)}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                      isChecked
                        ? 'border-primary bg-indigo-50/60 text-primary font-semibold'
                        : 'border-slate-200 bg-slate-50 text-charcoal-muted'
                    }`}
                  >
                    <span className="truncate">
                      M{idx + 1}: {m.title}
                    </span>
                    {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Selective Source Grounding */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-border shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white font-bold text-xs">2</span>
            <h3 className="text-sm font-bold text-charcoal">Choose Grounding Source Material</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllSources}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Select All
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={deselectAllSources}
              className="text-[11px] font-semibold text-charcoal-muted hover:underline"
            >
              Deselect All
            </button>
          </div>
        </div>

        <p className="text-xs text-charcoal-muted">
          NVIDIA AI grounds questions strictly on the selected learning content below.
        </p>

        {allRelevantLessons.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-charcoal-muted">
            No lessons available in the selected module(s). Please add lessons first.
          </div>
        ) : (
          <div className="space-y-2.5">
            {allRelevantLessons.map((lesson) => {
              const isLessonChecked = selectedLessonIds.includes(lesson.id);
              const hasDoc = Boolean(lesson.document_url);
              const isDocChecked = hasDoc && selectedDocUrls.includes(lesson.document_url as string);
              const docFilename = lesson.document_url?.split('/').pop() || 'Document.pdf';

              return (
                <div
                  key={lesson.id}
                  className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2 text-xs"
                >
                  {/* Lesson Content Checkbox */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none truncate">
                      <input
                        type="checkbox"
                        checked={isLessonChecked}
                        onChange={() => toggleLesson(lesson.id)}
                        className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4"
                      />
                      <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-semibold text-charcoal truncate">
                        Lesson: {lesson.title}
                      </span>
                    </label>

                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        lesson.content_body && lesson.content_body.trim().length > 20
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {lesson.content_body && lesson.content_body.trim().length > 20
                        ? `${lesson.content_body.trim().length} chars`
                        : 'No text body'}
                    </span>
                  </div>

                  {/* Attached Document Checkbox (if present) */}
                  {hasDoc && (
                    <div className="pl-6 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none truncate">
                        <input
                          type="checkbox"
                          checked={isDocChecked}
                          onChange={() => toggleDoc(lesson.document_url as string)}
                          className="rounded border-slate-300 text-primary focus:ring-primary w-3.5 h-3.5"
                        />
                        <FileCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="text-charcoal font-medium truncate">
                          Attached PDF: <span className="font-mono text-[11px] text-slate-600">{docFilename}</span>
                        </span>
                      </label>
                      <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded">
                        PDF Text Grounding
                      </span>
                    </div>
                  )}

                  {/* Video Transcript Status Badge */}
                  {lesson.video_url && (
                    <div className="pl-6 pt-1 flex items-center gap-2 text-[10px] text-slate-400 italic">
                      <Video className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Video transcript unavailable (audio transcription disabled)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 3: Question Parameters & Prompt Customization */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-border shadow-card space-y-6">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white font-bold text-xs">3</span>
            <h3 className="text-sm font-bold text-charcoal">Assessment Parameters</h3>
          </div>
          <span className="text-[11px] text-charcoal-muted">Quiz structure & difficulty</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Number of Questions */}
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1.5">
              Number of Questions
            </label>
            <select
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-white text-charcoal focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value={3}>3 Questions (Quick Check)</option>
              <option value={5}>5 Questions (Standard)</option>
              <option value={8}>8 Questions (Comprehensive)</option>
              <option value={10}>10 Questions (In-Depth Assessment)</option>
              <option value={15}>15 Questions (Final Exam Full Suite)</option>
            </select>
          </div>

          {/* Difficulty Level */}
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1.5">
              Difficulty Level
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-white text-charcoal focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="BEGINNER">Beginner (Foundational Concepts)</option>
              <option value="INTERMEDIATE">Intermediate (Practical Application)</option>
              <option value="ADVANCED">Advanced (Edge Cases & Architecture)</option>
            </select>
          </div>
        </div>

        {/* Question Types Checkboxes */}
        <div>
          <label className="block text-xs font-bold text-charcoal mb-1.5">
            Allowed Question Types
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { type: 'MCQ' as QuestionType, label: 'Single Choice (MCQ)', desc: '1 correct answer' },
              { type: 'TRUE_FALSE' as QuestionType, label: 'True / False', desc: 'Binary verification' },
              { type: 'MULTI_SELECT' as QuestionType, label: 'Multi-Select', desc: '2+ correct answers' },
            ].map((item) => {
              const isChecked = selectedTypes.includes(item.type);
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => toggleType(item.type)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isChecked
                      ? 'border-primary bg-indigo-50/50 text-primary'
                      : 'border-border bg-slate-50/60 text-charcoal-muted hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-charcoal">{item.label}</span>
                    {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <span className="text-[10px] text-charcoal-muted">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Guidance */}
        <Textarea
          label="Special Instructions / Focus Areas (Optional)"
          placeholder="e.g. Focus on variable immutability, data type casting, error handling, or performance tradeoffs..."
          rows={3}
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
        />

        {/* Generation Action Banner & Submit */}
        <div className="pt-4 border-t border-border space-y-4">
          {generateMutation.isPending ? (
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-primary font-bold text-xs">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating quiz with NVIDIA AI...
              </div>
              <p className="text-[11px] text-charcoal-muted">
                Extracting textual grounding context and generating validated questions with NVIDIA Llama 3.2.
                <br />
                <strong>This may take up to 1–2 minutes.</strong> Questions will be quarantined for your review upon completion.
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <span className="text-xs text-charcoal-muted">
              {selectedLessonIds.length} lesson(s) and {selectedDocUrls.length} document(s) selected
            </span>

            <Button
              size="md"
              isLoading={generateMutation.isPending}
              disabled={
                generateMutation.isPending ||
                (selectedLessonIds.length === 0 && selectedDocUrls.length === 0)
              }
              onClick={() => generateMutation.mutate()}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Generate Quiz with NVIDIA AI
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
