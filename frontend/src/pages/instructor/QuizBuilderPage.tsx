import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Plus,
  Trash2,
  Check,
  ArrowLeft,
  Save,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { quizzesApi } from '../../api/quizzes';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Toggle } from '../../components/ui/Toggle';
import { LoadingState } from '../../components/ui/LoadingState';
import { QuestionType } from '../../types';

export const QuizBuilderPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);

  // New Question form state
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('MCQ');
  const [explanation, setExplanation] = useState('');
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState<Array<{ text: string; is_correct: boolean }>>([
    { text: '', is_correct: true },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ]);

  // Fetch Authoring Quiz (unmasked)
  const { data: quiz, isLoading } = useQuery({
    queryKey: ['authoring-quiz', quizId],
    queryFn: () => quizzesApi.getAuthoring(quizId!),
    enabled: Boolean(quizId),
  });

  // Update Quiz Settings Mutation
  const updateQuizMutation = useMutation({
    mutationFn: (payload: any) => quizzesApi.update(quizId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authoring-quiz', quizId] });
      success('Settings Saved', 'Quiz settings updated.');
    },
    onError: (err: any) => {
      toastError('Update Failed', err.message);
    },
  });

  // Add Question Mutation
  const addQuestionMutation = useMutation({
    mutationFn: () =>
      quizzesApi.addQuestion(quizId!, {
        question_text: questionText,
        question_type: questionType,
        explanation: explanation || undefined,
        points: Number(points),
        options: options
          .filter((o) => o.text.trim())
          .map((o, idx) => ({
            option_text: o.text,
            is_correct: o.is_correct,
            order_index: idx + 1,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authoring-quiz', quizId] });
      success('Question Added', 'Question and options created.');
      setIsQuestionModalOpen(false);
      setQuestionText('');
      setExplanation('');
      setOptions([
        { text: '', is_correct: true },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
      ]);
    },
    onError: (err: any) => {
      toastError('Failed to add question', err.message);
    },
  });

  // Delete Question Mutation
  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => quizzesApi.deleteQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authoring-quiz', quizId] });
      success('Question Deleted', 'Question removed from assessment.');
    },
    onError: (err: any) => {
      toastError('Delete Failed', err.message);
    },
  });

  const handleOptionCorrectToggle = (index: number) => {
    if (questionType === 'MULTI_SELECT') {
      setOptions((prev) =>
        prev.map((o, i) => (i === index ? { ...o, is_correct: !o.is_correct } : o))
      );
    } else {
      setOptions((prev) =>
        prev.map((o, i) => ({ ...o, is_correct: i === index }))
      );
    }
  };

  const handleOptionTextChange = (index: number, text: string) => {
    setOptions((prev) =>
      prev.map((o, i) => (i === index ? { ...o, text } : o))
    );
  };

  if (isLoading) {
    return <LoadingState message="Loading assessment builder..." className="py-24" />;
  }

  if (!quiz) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-charcoal-muted hover:text-charcoal hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <Badge variant={quiz.is_active ? 'success' : 'warning'}>
          {quiz.is_active ? 'Active & Published' : 'Inactive Draft'}
        </Badge>
      </div>

      <PageHeader
        title={`Quiz Builder: ${quiz.title}`}
        description={`Type: ${quiz.quiz_type} • Passing Score: ${quiz.passing_score}% • Max Attempts: ${quiz.max_attempts}`}
        actions={
          <Button
            size="md"
            onClick={() => setIsQuestionModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Question
          </Button>
        }
      />

      {/* Questions List */}
      <div className="space-y-4">
        {quiz.questions && quiz.questions.length > 0 ? (
          quiz.questions.map((q, qIdx) => (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-primary">Question {qIdx + 1}</span>
                    <Badge variant="outline" size="sm">
                      {q.question_type}
                    </Badge>
                    <span className="text-xs text-charcoal-muted">({q.points} pt)</span>
                  </div>
                  <h3 className="text-base font-bold text-charcoal">{q.question_text}</h3>
                </div>

                <button
                  onClick={() => {
                    if (window.confirm('Delete this question?')) {
                      deleteQuestionMutation.mutate(q.id);
                    }
                  }}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-border/60">
                {q.options?.map((opt) => (
                  <div
                    key={opt.id}
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                      opt.is_correct
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-charcoal'
                    }`}
                  >
                    <span>{opt.option_text}</span>
                    {opt.is_correct && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-white px-2 py-0.5 rounded border border-emerald-200">
                        Correct Answer
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {q.explanation && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-charcoal-muted border border-slate-200">
                  <strong className="text-charcoal block mb-0.5">Explanation:</strong>
                  {q.explanation}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-border text-center space-y-3">
            <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-charcoal">No Questions in Assessment</h3>
            <p className="text-xs text-charcoal-muted max-w-sm mx-auto">
              Add your first multiple choice, true/false, or multi-select question.
            </p>
            <Button size="sm" onClick={() => setIsQuestionModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
              Add Question
            </Button>
          </div>
        )}
      </div>

      {/* Add Question Modal */}
      <Modal
        isOpen={isQuestionModalOpen}
        onClose={() => setIsQuestionModalOpen(false)}
        size="lg"
        title="Add Assessment Question"
        description="Configure question text, question type, points, options, and explanations."
      >
        <div className="space-y-4">
          <Input
            label="Question Text"
            placeholder="e.g. Which keyword is used to define an asynchronous coroutine in Python?"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Question Type"
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value as QuestionType)}
            >
              <option value="MCQ">Multiple Choice (Single Answer)</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="MULTI_SELECT">Multi-Select (Multiple Answers)</option>
            </Select>

            <Input
              label="Points"
              type="number"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </div>

          {/* Options Builder */}
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="block text-xs font-semibold text-charcoal">
              Answer Options (Click checkmark to mark as correct)
            </label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOptionCorrectToggle(idx)}
                  className={`p-2 rounded-lg border transition-colors shrink-0 ${
                    opt.is_correct
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-slate-100 border-slate-300 text-slate-400 hover:text-slate-600'
                  }`}
                  title={opt.is_correct ? 'Marked Correct' : 'Mark as Correct'}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </button>

                <input
                  type="text"
                  placeholder={`Option ${idx + 1}`}
                  value={opt.text}
                  onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                  className="flex-1 text-sm rounded-lg border border-border px-3 py-2 text-charcoal focus:border-primary focus:outline-none"
                />
              </div>
            ))}
          </div>

          <Textarea
            label="Explanation (Optional)"
            placeholder="Provide context explaining why the correct answer is right..."
            rows={2}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />

          <div className="pt-4 border-t border-border flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsQuestionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addQuestionMutation.mutate()}
              isLoading={addQuestionMutation.isPending}
              disabled={!questionText.trim()}
            >
              Save Question
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
