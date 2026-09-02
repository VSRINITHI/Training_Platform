import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Check,
  AlertTriangle,
  Layers,
  FileCheck,
  Cpu,
  Info,
} from 'lucide-react';
import { aiDraftsApi } from '../../api/aiDrafts';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/ui/LoadingState';
import { QuizType } from '../../types';

export const AIDraftReviewPage: React.FC = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [targetType, setTargetType] = useState<QuizType>('MODULE');

  const { data: draft, isLoading } = useQuery({
    queryKey: ['ai-draft-detail', draftId],
    queryFn: () => aiDraftsApi.getDraft(draftId!),
    enabled: Boolean(draftId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ status, importToQuiz }: { status: 'APPROVED' | 'DISCARDED'; importToQuiz: boolean }) =>
      aiDraftsApi.reviewDraft(draftId!, {
        status,
        import_to_quiz: importToQuiz,
        target_type: targetType,
      }),
    onSuccess: (updatedDraft) => {
      if (updatedDraft.status === 'APPROVED') {
        success('Draft Approved & Imported! 🎉', `Questions have been inserted into the ${targetType.toLowerCase()} quiz.`);
      } else {
        success('Draft Discarded', 'Draft marked as discarded.');
      }
      navigate('/instructor/ai-drafts');
    },
    onError: (err: any) => {
      toastError('Review Action Failed', err.response?.data?.detail || err.message || 'Error updating draft');
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading AI draft details..." className="py-24" />;
  }

  // Extract questions list
  let questions: any[] = [];
  if (draft?.raw_llm_response) {
    if (Array.isArray(draft.raw_llm_response)) {
      questions = draft.raw_llm_response;
    } else if (draft.raw_llm_response.questions && Array.isArray(draft.raw_llm_response.questions)) {
      questions = draft.raw_llm_response.questions;
    }
  }

  const isPending = draft?.status === 'PENDING_REVIEW';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-xs text-charcoal-muted mb-2">
        <Link to="/instructor/ai-drafts" className="hover:text-charcoal hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to AI Quarantine Queue
        </Link>
      </div>

      <PageHeader
        title="Review Quarantined AI Draft"
        description="Inspect generated questions, options, and explanations before approving into live quizzes."
        badge={<StatusBadge status={draft?.status || 'PENDING_REVIEW'} />}
      />

      {/* Human-in-the-Loop Quarantine Banner */}
      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3 leading-relaxed">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Human-in-the-Loop Review Gate</p>
          <p className="mt-0.5 text-amber-800">
            Reviewing is an immutable one-time action. Approving will parse these questions and insert them into the active assessment for learners.
          </p>
        </div>
      </div>

      {/* Target Destination Selector (if pending review) */}
      {isPending && (
        <div className="bg-white p-5 rounded-2xl border border-border shadow-card space-y-3">
          <label className="block text-xs font-bold text-charcoal flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary" />
            <span>Target Assessment Destination</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { type: 'MODULE' as QuizType, title: 'Module Assessment Checkpoint', desc: 'Attach questions to the module assessment checkpoint' },
              { type: 'FINAL' as QuizType, title: 'Course Final Certification Exam', desc: 'Attach questions to the comprehensive final exam' },
            ].map((dest) => (
              <button
                key={dest.type}
                type="button"
                onClick={() => setTargetType(dest.type)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  targetType === dest.type
                    ? 'border-primary bg-indigo-50/60 text-primary'
                    : 'border-border bg-slate-50/50 text-charcoal-muted hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-bold text-charcoal block mb-0.5">{dest.title}</span>
                <span className="text-[10px] text-charcoal-muted">{dest.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Questions Preview List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-charcoal flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-primary" />
            <span>Generated Questions ({questions.length})</span>
          </h3>
          <span className="text-xs text-charcoal-muted">NVIDIA Llama 3.1 8B Output</span>
        </div>

        {questions.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-border text-center text-xs text-charcoal-muted">
            No parsed questions found in this draft payload.
          </div>
        ) : (
          questions.map((q: any, idx: number) => (
            <div
              key={idx}
              className="bg-white p-5 sm:p-6 rounded-2xl border border-border shadow-card space-y-3"
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-indigo-50 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-charcoal block leading-snug">
                      {q.question_text}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {q.question_type || 'MCQ'}
                  </span>
                  <span className="text-[10px] font-bold text-primary bg-indigo-50 px-2 py-0.5 rounded">
                    {q.points || 1} pt{q.points !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-1.5 pl-8">
                {(q.options || []).map((opt: any, optIdx: number) => {
                  const isCorrect =
                    opt.is_correct === true ||
                    opt.is_correct === 'true' ||
                    opt.is_correct === 1;

                  return (
                    <div
                      key={optIdx}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        isCorrect
                          ? 'border-emerald-300 bg-emerald-50/80 text-emerald-900 font-semibold'
                          : 'border-border/70 bg-slate-50/50 text-charcoal'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border border-current text-[10px] flex items-center justify-center font-bold">
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span>{opt.option_text}</span>
                      </div>
                      {isCorrect && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="w-3 h-3" /> Correct
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              {q.explanation && (
                <div className="ml-8 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-charcoal-muted leading-relaxed space-y-0.5">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-primary" />
                    Explanation:
                  </span>
                  <p>{q.explanation}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Action Footer */}
      {isPending && (
        <div className="bg-white p-5 rounded-2xl border border-border shadow-card flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="outline"
            className="text-rose-600 border-rose-200 hover:bg-rose-50 w-full sm:w-auto"
            isLoading={reviewMutation.isPending}
            onClick={() =>
              reviewMutation.mutate({
                status: 'DISCARDED',
                importToQuiz: false,
              })
            }
            leftIcon={<XCircle className="w-4 h-4" />}
          >
            Discard Draft
          </Button>

          <Button
            variant="primary"
            className="w-full sm:w-auto"
            isLoading={reviewMutation.isPending}
            onClick={() =>
              reviewMutation.mutate({
                status: 'APPROVED',
                importToQuiz: true,
              })
            }
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Approve & Import Questions to {targetType} Quiz
          </Button>
        </div>
      )}
    </div>
  );
};
