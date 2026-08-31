import React from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Award,
  BookOpen,
} from 'lucide-react';
import { quizzesApi } from '../../api/quizzes';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { QuizSubmissionResult } from '../../types';

export const QuizResultPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const submissionResult = (location.state as any)?.result as QuizSubmissionResult | undefined;

  // Fallback: fetch attempts history if refreshed
  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ['my-quiz-attempts', quizId],
    queryFn: () => quizzesApi.getMyAttempts(quizId!),
    enabled: !submissionResult && Boolean(quizId),
  });

  if (isLoading) {
    return <LoadingState message="Loading assessment score..." className="py-24" />;
  }

  const latestAttempt = submissionResult || (attempts.length > 0 ? attempts[0] : null);

  if (!latestAttempt) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4 bg-white p-8 rounded-2xl border border-border">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-charcoal">No Assessment Results Found</h2>
        <p className="text-xs text-charcoal-muted">
          You haven't submitted this assessment yet or the attempt record was not found.
        </p>
        <Link to={`/learner/quiz/${quizId}`}>
          <Button size="sm">Start Assessment</Button>
        </Link>
      </div>
    );
  }

  const isPassed = latestAttempt.is_passed;
  const scoreAchieved = Number(latestAttempt.score_achieved);
  const passingScore = submissionResult?.passing_score ?? 70;
  const relearningTriggered = (latestAttempt as any).relearning_triggered;

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      {/* Result Hero Banner */}
      <div
        className={`p-6 sm:p-8 rounded-2xl border shadow-card text-center space-y-4 ${
          isPassed
            ? 'bg-gradient-to-b from-emerald-50/80 to-white border-emerald-200'
            : 'bg-gradient-to-b from-rose-50/80 to-white border-rose-200'
        }`}
      >
        <div className="inline-flex p-3 rounded-full mb-1">
          {isPassed ? (
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
              <CheckCircle2 className="w-10 h-10" />
            </div>
          ) : (
            <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
              <XCircle className="w-10 h-10" />
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-charcoal tracking-tight">
            {isPassed ? 'Assessment Passed! 🎉' : 'Assessment Not Passed'}
          </h1>
          <p className="text-xs sm:text-sm text-charcoal-muted mt-1 max-w-md mx-auto">
            {isPassed
              ? 'Congratulations! You have demonstrated competency in this topic.'
              : 'You did not meet the passing score threshold for this assessment.'}
          </p>
        </div>

        {/* Score Display */}
        <div className="flex items-center justify-center gap-8 py-4 border-y border-slate-200/60 max-w-md mx-auto">
          <div>
            <span className="text-xs font-semibold text-charcoal-muted uppercase">Your Score</span>
            <p className={`text-3xl font-extrabold ${isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
              {Math.round(scoreAchieved)}%
            </p>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div>
            <span className="text-xs font-semibold text-charcoal-muted uppercase">Passing Score</span>
            <p className="text-3xl font-extrabold text-charcoal">{Math.round(passingScore)}%</p>
          </div>
        </div>

        {/* Relearning Alert */}
        {relearningTriggered && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs text-left flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Relearning Required</p>
              <p className="mt-0.5 leading-relaxed">
                You have reached the maximum allowed attempts for this cycle. Please reset and review previous module lessons before re-attempting.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link to="/learner">
            <Button variant="outline" size="md">
              Return to Dashboard
            </Button>
          </Link>

          {!isPassed && !relearningTriggered && (
            <Link to={`/learner/quiz/${quizId}`}>
              <Button size="md" leftIcon={<RotateCcw className="w-4 h-4" />}>
                Retry Assessment
              </Button>
            </Link>
          )}

          {isPassed && (
            <Link to="/learner/progress">
              <Button size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Continue Learning
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Question by Question Review if results are available */}
      {submissionResult?.question_results && submissionResult.question_results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-charcoal">Answer Explanations & Feedback</h2>
          <div className="space-y-3">
            {submissionResult.question_results.map((qr, idx) => (
              <div
                key={qr.question_id}
                className="bg-white p-5 rounded-xl border border-border shadow-card space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-charcoal">Question {idx + 1}</span>
                  {qr.is_correct ? (
                    <Badge variant="success" size="sm">
                      Correct (+{qr.points_awarded} pts)
                    </Badge>
                  ) : (
                    <Badge variant="danger" size="sm">
                      Incorrect (0/{qr.max_points} pts)
                    </Badge>
                  )}
                </div>

                {qr.explanation && (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-charcoal-muted leading-relaxed">
                    <strong className="text-charcoal block mb-0.5">Explanation:</strong>
                    {qr.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
