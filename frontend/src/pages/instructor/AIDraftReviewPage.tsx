import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { aiDraftsApi } from '../../api/aiDrafts';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';

export const AIDraftReviewPage: React.FC = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const reviewMutation = useMutation({
    mutationFn: ({ status, importToQuiz }: { status: 'APPROVED' | 'DISCARDED'; importToQuiz: boolean }) =>
      aiDraftsApi.reviewDraft(draftId!, {
        status,
        import_to_quiz: importToQuiz,
      }),
    onSuccess: (updatedDraft) => {
      if (updatedDraft.status === 'APPROVED') {
        success('Draft Approved & Imported! 🎉', 'Questions have been inserted into the live lesson quiz.');
      } else {
        success('Draft Discarded', 'Draft status set to DISCARDED.');
      }
      navigate('/instructor/ai-drafts');
    },
    onError: (err: any) => {
      toastError('Review Action Failed', err.message);
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-xs text-charcoal-muted mb-2">
        <Link to="/instructor/ai-drafts" className="hover:text-charcoal hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to AI Quarantine Queue
        </Link>
      </div>

      <PageHeader
        title="Review Quarantined AI Draft"
        description="Inspect generated questions and decide whether to approve and import them into the lesson quiz."
        badge={<StatusBadge status="PENDING_REVIEW" />}
      />

      {/* Review Gate Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-6">
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Human-in-the-Loop Review Gate</p>
            <p className="mt-0.5">
              Reviewing is an immutable one-time action. Once approved, valid questions will be created directly on the lesson's quiz.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
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
            Approve & Import to Quiz
          </Button>
        </div>
      </div>
    </div>
  );
};
