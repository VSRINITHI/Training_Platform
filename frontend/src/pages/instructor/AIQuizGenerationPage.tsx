import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  ArrowLeft,
  BookOpen,
  Send,
  AlertCircle,
  FileJson,
  HelpCircle,
} from 'lucide-react';
import { lessonsApi } from '../../api/lessons';
import { aiDraftsApi } from '../../api/aiDrafts';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { LoadingState } from '../../components/ui/LoadingState';

export const AIQuizGenerationPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [promptContext, setPromptContext] = useState('');
  const [rawJson, setRawJson] = useState(`[
  {
    "question_text": "Sample AI Question: What is the main characteristic of Python functions?",
    "question_type": "MCQ",
    "points": 1,
    "explanation": "Functions are first-class citizens in Python.",
    "options": [
      { "option_text": "They are first-class citizens", "is_correct": true },
      { "option_text": "They cannot return values", "is_correct": false },
      { "option_text": "They must be compiled before execution", "is_correct": false }
    ]
  }
]`);

  // Fetch lesson
  const { data: lesson, isLoading } = useQuery({
    queryKey: ['lesson-ai-gen', lessonId],
    queryFn: () => lessonsApi.get(lessonId!),
    enabled: Boolean(lessonId),
  });

  // Create Draft Mutation
  const createDraftMutation = useMutation({
    mutationFn: async () => {
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(rawJson);
      } catch (err) {
        throw new Error('Invalid JSON format. Please ensure valid JSON array or object.');
      }

      return aiDraftsApi.createDraft(lessonId!, {
        lesson_id: lessonId!,
        prompt_context: promptContext || lesson?.title || undefined,
        raw_llm_response: parsedJson,
      });
    },
    onSuccess: (draft) => {
      success('AI Draft Quarantined', 'Draft submitted for instructor review.');
      navigate(`/instructor/ai-drafts/${draft.id}`);
    },
    onError: (err: any) => {
      toastError('Draft Submission Failed', err.message);
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading lesson context..." className="py-24" />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-xs text-charcoal-muted mb-2">
        <Link to="/instructor/ai-drafts" className="hover:text-charcoal hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to AI Drafts
        </Link>
      </div>

      <PageHeader
        title="AI Quiz Generation & Draft Quarantine"
        description={`Source Lesson: ${lesson?.title || ''}`}
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-primary border border-indigo-200 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            AI Draft Pipeline
          </span>
        }
      />

      {/* AI Notice Banner */}
      <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 text-xs text-slate-700 flex items-start gap-3 leading-relaxed">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-primary">Human-in-the-Loop Quarantine Pipeline</p>
          <p className="mt-0.5 text-charcoal-muted">
            All AI-generated questions are quarantined with <code className="bg-white px-1 py-0.5 rounded text-amber-700 font-mono font-bold">PENDING_REVIEW</code> status and isolated from learners until explicitly approved by the instructor.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-5">
        <Input
          label="Prompt / Topic Context"
          placeholder="e.g. Focus on lambda functions, closures, and scope..."
          value={promptContext}
          onChange={(e) => setPromptContext(e.target.value)}
        />

        <Textarea
          label="Draft JSON Payload (Supports MCQ, True/False, Multi-Select)"
          rows={10}
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          className="font-mono text-xs"
        />

        <div className="pt-4 border-t border-border flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-xs text-charcoal-muted hover:underline"
          >
            Cancel
          </button>

          <Button
            size="md"
            isLoading={createDraftMutation.isPending}
            onClick={() => createDraftMutation.mutate()}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Submit to Quarantine Queue
          </Button>
        </div>
      </div>
    </div>
  );
};
