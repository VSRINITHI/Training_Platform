import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  HelpCircle,
  Clock,
  Award,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertCircle,
  Check,
} from 'lucide-react';
import { quizzesApi } from '../../api/quizzes';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { QuizAnswerSubmission } from '../../types';

export const QuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { error: toastError } = useToast();

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});

  // Fetch Public Quiz
  const {
    data: quiz,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['quiz-public', quizId],
    queryFn: () => quizzesApi.getPublic(quizId!),
    enabled: Boolean(quizId),
  });

  // Submit Quiz Mutation
  const submitMutation = useMutation({
    mutationFn: (answers: QuizAnswerSubmission[]) =>
      quizzesApi.submit(quizId!, { answers }),
    onSuccess: (result) => {
      navigate(`/learner/quiz/${quizId}/result`, { state: { result } });
    },
    onError: (err: any) => {
      toastError('Submission Failed', err.message);
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading assessment questions..." className="py-24" />;
  }

  if (isError || !quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <ErrorState
        title="Assessment Unavailable"
        message="This quiz has no published questions or could not be loaded."
        onRetry={refetch}
      />
    );
  }

  const questions = quiz.questions;
  const currentQuestion = questions[currentQuestionIdx];
  const totalQuestions = questions.length;
  const progressPct = ((currentQuestionIdx + 1) / totalQuestions) * 100;

  const currentSelection = selectedAnswers[currentQuestion.id] || [];

  const handleOptionToggle = (optionId: string) => {
    if (currentQuestion.question_type === 'MULTI_SELECT') {
      setSelectedAnswers((prev) => {
        const current = prev[currentQuestion.id] || [];
        const updated = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [currentQuestion.id]: updated };
      });
    } else {
      // Single select for MCQ and TRUE_FALSE
      setSelectedAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: [optionId],
      }));
    }
  };

  const handleFinalSubmit = () => {
    const formattedAnswers: QuizAnswerSubmission[] = Object.entries(selectedAnswers).map(
      ([question_id, selected_option_ids]) => ({
        question_id,
        selected_option_ids,
      })
    );

    if (formattedAnswers.length < totalQuestions) {
      const confirmSubmit = window.confirm(
        `You have answered ${formattedAnswers.length} of ${totalQuestions} questions. Do you want to submit anyway?`
      );
      if (!confirmSubmit) return;
    }

    submitMutation.mutate(formattedAnswers);
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1">
              <Award className="w-4 h-4" />
              <span>Competency Assessment ({quiz.quiz_type})</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-charcoal">{quiz.title}</h1>
          </div>
          <div className="text-right">
            <span className="text-xs text-charcoal-muted">Passing Score</span>
            <p className="text-sm font-bold text-charcoal">{quiz.passing_score}%</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-2 border-t border-border/60">
          <div className="flex justify-between text-xs font-medium text-charcoal-muted">
            <span>
              Question {currentQuestionIdx + 1} of {totalQuestions}
            </span>
            <span>{Math.round(progressPct)}% Completed</span>
          </div>
          <ProgressBar value={progressPct} size="sm" />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-charcoal-muted">
            <span className="font-semibold text-primary">
              {currentQuestion.question_type === 'MULTI_SELECT'
                ? 'Select all correct options'
                : 'Select one option'}
            </span>
            <span>{currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-charcoal leading-snug">
            {currentQuestion.question_text}
          </h2>
        </div>

        {/* Options List */}
        <div className="space-y-3 pt-2">
          {currentQuestion.options.map((opt) => {
            const isSelected = currentSelection.includes(opt.id);
            const isMulti = currentQuestion.question_type === 'MULTI_SELECT';

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleOptionToggle(opt.id)}
                className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                  isSelected
                    ? 'border-primary bg-primary-light/50 ring-2 ring-primary shadow-sm'
                    : 'border-border bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-5 h-5 mt-0.5 shrink-0 transition-colors ${
                    isMulti
                      ? `rounded border ${isSelected ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'}`
                      : `rounded-full border ${isSelected ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'}`
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>

                <span className="text-sm font-medium text-charcoal leading-relaxed">
                  {opt.option_text}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom Nav Controls */}
        <div className="pt-6 border-t border-border flex items-center justify-between">
          <Button
            variant="outline"
            size="md"
            disabled={currentQuestionIdx === 0}
            onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Previous
          </Button>

          {currentQuestionIdx < totalQuestions - 1 ? (
            <Button
              size="md"
              onClick={() => setCurrentQuestionIdx((p) => Math.min(totalQuestions - 1, p + 1))}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next Question
            </Button>
          ) : (
            <Button
              size="md"
              variant="primary"
              isLoading={submitMutation.isPending}
              onClick={handleFinalSubmit}
              rightIcon={<Send className="w-4 h-4" />}
            >
              Submit Assessment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
