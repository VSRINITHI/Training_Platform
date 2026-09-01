import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Plus,
  ArrowLeft,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { quizzesApi } from '../../api/quizzes';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { QuizType } from '../../types';

export const QuizManagementPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | QuizType>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [quizType, setQuizType] = useState<QuizType>('MODULE');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [passingScore, setPassingScore] = useState<number>(75);
  const [maxAttempts, setMaxAttempts] = useState<number>(3);

  // Fetch Course details
  const { data: course, isLoading } = useQuery({
    queryKey: ['course-quizzes-view', courseId],
    queryFn: () => coursesApi.get(courseId!),
    enabled: Boolean(courseId),
  });

  // Create Quiz Mutation
  const createQuizMutation = useMutation({
    mutationFn: () =>
      quizzesApi.create({
        title,
        quiz_type: quizType,
        passing_score: Number(passingScore),
        max_attempts: Number(maxAttempts),
        course_id: quizType === 'FINAL' ? courseId : undefined,
        module_id: quizType === 'MODULE' ? targetId : undefined,
        lesson_id: quizType === 'LESSON' ? targetId : undefined,
      }),
    onSuccess: (newQuiz) => {
      queryClient.invalidateQueries({ queryKey: ['course-quizzes-view', courseId] });
      success('Quiz Created', 'Assessment checkpoint created successfully.');
      setIsCreateModalOpen(false);
      setTitle('');
    },
    onError: (err: any) => {
      toastError('Failed to create quiz', err.message);
    },
  });

  // Delete Quiz Mutation
  const deleteQuizMutation = useMutation({
    mutationFn: (quizId: string) => quizzesApi.delete(quizId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-quizzes-view', courseId] });
      success('Quiz Deleted', 'Assessment deleted.');
    },
    onError: (err: any) => {
      toastError('Delete Failed', err.message);
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading course assessments..." className="py-24" />;
  }

  const modules = course?.modules || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-charcoal-muted mb-2">
        <Link to="/instructor/courses" className="hover:text-charcoal hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Courses
        </Link>
      </div>

      <PageHeader
        title={`Assessments: ${course?.title}`}
        description="Configure module checkpoints, lesson quizzes, and final certification exams."
        actions={
          <Button
            size="md"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Assessment
          </Button>
        }
      />

      {/* Overview Cards by Type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Module Assessments</span>
            <Award className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm text-charcoal-muted mt-2">Required for module unlock & progress</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Lesson Quizzes</span>
            <HelpCircle className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-sm text-charcoal-muted mt-2">Quick self-check assessments</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Final Exam</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-sm text-charcoal-muted mt-2">Unlocks certificate issuance</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-96">
          <SearchInput
            placeholder="Search assessment checkpoints by module title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterType === 'ALL'
                ? 'bg-white text-primary shadow-sm'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            All Checkpoints
          </button>
          <button
            type="button"
            onClick={() => setFilterType('MODULE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterType === 'MODULE'
                ? 'bg-white text-primary shadow-sm'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            Module Quizzes
          </button>
          <button
            type="button"
            onClick={() => setFilterType('FINAL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterType === 'FINAL'
                ? 'bg-white text-primary shadow-sm'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            Final Exam
          </button>
        </div>
      </div>

      {/* Target Module / Chapter Selectable Setup */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-card space-y-4">
        <h3 className="text-base font-bold text-charcoal">Course Curriculum Checkpoints</h3>
        <p className="text-xs text-charcoal-muted">
          Attach quizzes to specific modules or define the course-level final exam.
        </p>

        <div className="space-y-3 pt-2">
          {modules
            .filter(
              (mod) =>
                (filterType === 'ALL' || filterType === 'MODULE') &&
                mod.title.toLowerCase().includes(search.toLowerCase())
            )
            .map((mod, idx) => (
              <div
                key={mod.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-primary">Module {idx + 1}</span>
                  <h4 className="text-sm font-bold text-charcoal">{mod.title}</h4>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQuizType('MODULE');
                    setTargetId(mod.id);
                    setTitle(`${mod.title} Assessment`);
                    setIsCreateModalOpen(true);
                  }}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Create Module Quiz
                </Button>
              </div>
            ))}

          {/* Final Exam Bar */}
          {(filterType === 'ALL' || filterType === 'FINAL') &&
            ('final certification exam'.includes(search.toLowerCase()) ||
              (course?.title && course.title.toLowerCase().includes(search.toLowerCase()))) && (
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-700">Course Graduation</span>
                  <h4 className="text-sm font-bold text-charcoal">Final Certification Exam</h4>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQuizType('FINAL');
                    setTargetId(courseId!);
                    setTitle(`${course?.title} Final Exam`);
                    setIsCreateModalOpen(true);
                  }}
                  leftIcon={<Award className="w-3.5 h-3.5" />}
                >
                  Create Final Exam
                </Button>
              </div>
            )}
        </div>
      </div>

      {/* Create Quiz Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Configure Assessment"
        description="Define assessment parameters, passing score, and retry limits."
      >
        <div className="space-y-4">
          <Input
            label="Assessment Title"
            placeholder="e.g. Module 1 Competency Assessment"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Select
            label="Assessment Type"
            value={quizType}
            onChange={(e) => setQuizType(e.target.value as QuizType)}
          >
            <option value="MODULE">Module Assessment</option>
            <option value="LESSON">Lesson Quiz</option>
            <option value="FINAL">Course Final Certification Exam</option>
          </Select>

          {quizType === 'MODULE' && (
            <Select
              label="Target Module"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="" disabled>
                Select target module
              </option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </Select>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Passing Score (%)"
              type="number"
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
            />
            <Input
              label="Max Attempts per Cycle"
              type="number"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
            />
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createQuizMutation.mutate()}
              isLoading={createQuizMutation.isPending}
              disabled={!title.trim() || (quizType === 'MODULE' && !targetId)}
            >
              Create Quiz
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
