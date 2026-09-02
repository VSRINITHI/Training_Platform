import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Printer,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { quizzesApi } from '../../api/quizzes';
import { certificatesApi } from '../../api/certificates';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { QuizSubmissionResult, Certificate } from '../../types';
import { ProfessionalCertificate } from '../../components/certificate/ProfessionalCertificate';

export const QuizResultPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [isCongratsModalOpen, setIsCongratsModalOpen] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);

  const submissionResult = (location.state as any)?.result as QuizSubmissionResult | undefined;

  // 1. Fetch Quiz Details to know if it is a FINAL assessment
  const { data: quiz } = useQuery({
    queryKey: ['quiz-detail', quizId],
    queryFn: () => quizzesApi.getPublic(quizId!),
    enabled: Boolean(quizId),
  });

  // 2. Fallback: fetch attempts history if refreshed
  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ['my-quiz-attempts', quizId],
    queryFn: () => quizzesApi.getMyAttempts(quizId!),
    enabled: !submissionResult && Boolean(quizId),
  });

  // 3. Fetch User's Certificates to retrieve the newly generated certificate
  const { data: certificates = [] } = useQuery({
    queryKey: ['my-certificates'],
    queryFn: certificatesApi.getMyCertificates,
    enabled: Boolean(quiz?.quiz_type === 'FINAL' || (submissionResult as any)?.is_course_completed),
  });

  const latestAttempt = submissionResult || (attempts.length > 0 ? attempts[0] : null);

  const isPassed = latestAttempt?.is_passed;
  const isFinalExam = quiz?.quiz_type === 'FINAL' || (submissionResult as any)?.is_course_completed;

  // Find matching certificate if this is a completed course
  const courseCertificate = certificates.find(
    (c) => c.course_id === quiz?.course_id || c.course?.id === quiz?.course_id
  );

  // Automatically open congratulations modal if passing the final exam
  useEffect(() => {
    if (isPassed && isFinalExam) {
      setIsCongratsModalOpen(true);
    }
  }, [isPassed, isFinalExam]);

  if (isLoading) {
    return <LoadingState message="Loading assessment score..." className="py-24" />;
  }

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

  const scoreAchieved = Number(latestAttempt.score_achieved);
  const passingScore = submissionResult?.passing_score ?? (quiz?.passing_score ? Number(quiz.passing_score) : 70);
  const relearningTriggered = (latestAttempt as any).relearning_triggered;
  const learnerFullName = profile?.full_name || 'Learner';
  const courseTitle = quiz?.title ? quiz.title.replace('Assessment: ', '').replace('Final Exam: ', '') : 'Course';

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      {/* Course Completion Celebration Banner for Final Exam */}
      {isPassed && isFinalExam && (
        <div className="bg-gradient-to-r from-[#0f2444] via-[#1e3a8a] to-[#0f2444] text-white p-6 sm:p-8 rounded-2xl shadow-xl space-y-4 text-center border-2 border-[#c59b27]/40">
          <div className="inline-flex p-3 bg-[#c59b27]/20 border border-[#c59b27]/40 rounded-full">
            <Award className="w-10 h-10 text-[#fef3c7]" />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#fef3c7]">
              Course Graduation & Competency Certified
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-extrabold tracking-wide">
              🎉 Congratulations, {learnerFullName}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 max-w-lg mx-auto pt-1">
              You have successfully completed all required modules, checkpoints, and passed the final course assessment. Your verified certificate of completion is ready.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              size="md"
              onClick={() => setIsCertificateModalOpen(true)}
              className="bg-[#c59b27] hover:bg-[#b48a20] text-[#0f2444] font-bold shadow-md"
              leftIcon={<Award className="w-4 h-4 text-[#0f2444]" />}
            >
              View Certificate
            </Button>
            <Link to="/learner/certificates">
              <Button
                size="md"
                variant="outline"
                className="text-white border-white/30 hover:bg-white/10"
                leftIcon={<Eye className="w-4 h-4" />}
              >
                Go to My Certificates
              </Button>
            </Link>
          </div>
        </div>
      )}

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
          <h2 className="text-2xl sm:text-3xl font-extrabold text-charcoal tracking-tight">
            {isPassed ? 'Assessment Passed! 🎉' : 'Assessment Not Passed'}
          </h2>
          <p className="text-xs sm:text-sm text-charcoal-muted mt-1 max-w-md mx-auto">
            {isPassed
              ? isFinalExam
                ? 'Excellent work! You have satisfied all competency requirements for certification.'
                : 'Congratulations! You have demonstrated competency in this topic.'
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

          {isPassed && !isFinalExam && (
            <Link to="/learner/progress">
              <Button size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Continue Learning
              </Button>
            </Link>
          )}

          {isPassed && isFinalExam && (
            <Button
              size="md"
              onClick={() => setIsCertificateModalOpen(true)}
              leftIcon={<Award className="w-4 h-4" />}
            >
              View Certificate
            </Button>
          )}
        </div>
      </div>

      {/* Question by Question Review if results are available */}
      {submissionResult?.question_results && submissionResult.question_results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-charcoal">Answer Explanations & Feedback</h3>
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

      {/* Congratulations Modal */}
      <Modal
        isOpen={isCongratsModalOpen}
        onClose={() => setIsCongratsModalOpen(false)}
        size="md"
        title="🎉 Course Completed!"
      >
        <div className="text-center space-y-4 py-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <Award className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-serif font-bold text-charcoal">
              Congratulations, {learnerFullName}!
            </h3>
            <p className="text-xs text-charcoal-muted max-w-sm mx-auto">
              You have successfully completed all required lessons, module checkpoints, and the final course assessment for:
            </p>
            <p className="text-base font-bold text-primary pt-1">
              {courseTitle}
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="md"
              onClick={() => {
                setIsCongratsModalOpen(false);
                setIsCertificateModalOpen(true);
              }}
              leftIcon={<Award className="w-4 h-4" />}
            >
              View Certificate
            </Button>
            <Button
              size="md"
              variant="outline"
              onClick={() => {
                setIsCongratsModalOpen(false);
                navigate('/learner/progress');
              }}
            >
              Back to My Progress
            </Button>
          </div>
        </div>
      </Modal>

      {/* Certificate Viewer Modal */}
      <Modal
        isOpen={isCertificateModalOpen}
        onClose={() => setIsCertificateModalOpen(false)}
        size="xl"
        title="Official Certificate of Completion"
      >
        <div className="space-y-6">
          <div className="overflow-x-auto py-2">
            <ProfessionalCertificate
              studentName={courseCertificate?.student_name || learnerFullName}
              courseTitle={courseCertificate?.course_title || courseTitle}
              certificateNumber={courseCertificate?.certificate_number || `DC-${new Date().getFullYear()}-VERIFIED`}
              issuedAt={courseCertificate?.issued_at || new Date().toISOString()}
              verificationHash={courseCertificate?.verification_hash}
              instructorName={courseCertificate?.instructor_name || 'Course Faculty'}
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
            <div className="text-xs text-slate-500">
              <span>Credential Number: </span>
              <span className="font-mono font-bold text-slate-800">
                {courseCertificate?.certificate_number || `DC-${new Date().getFullYear()}-VERIFIED`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {courseCertificate && (
                <a
                  href={`/verify-certificate/${courseCertificate.certificate_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-print"
                >
                  <Button size="sm" variant="outline" leftIcon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}>
                    Verify Certificate
                  </Button>
                </a>
              )}

              <Button
                size="sm"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
                className="bg-[#0f2444] hover:bg-[#1a365d] text-white"
              >
                Print / Save PDF
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

