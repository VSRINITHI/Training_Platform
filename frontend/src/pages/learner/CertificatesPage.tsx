import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, ShieldCheck, Download, ExternalLink, Sparkles, Printer, Eye, X } from 'lucide-react';
import { certificatesApi } from '../../api/certificates';
import { progressApi } from '../../api/progress';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Certificate } from '../../types';
import { ProfessionalCertificate } from '../../components/certificate/ProfessionalCertificate';

export const CertificatesPage: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);

  // 1. Fetch user's certificates
  const { data: certificates = [], isLoading: loadingCerts } = useQuery({
    queryKey: ['my-certificates'],
    queryFn: certificatesApi.getMyCertificates,
  });

  // 2. Fetch completed enrollments that might be eligible to claim
  const { data: enrollments = [] } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: progressApi.getMyEnrollments,
  });

  // Claim Certificate Mutation
  const claimMutation = useMutation({
    mutationFn: (courseId: string) => certificatesApi.claim(courseId),
    onSuccess: (newCert) => {
      queryClient.invalidateQueries({ queryKey: ['my-certificates'] });
      success('Certificate Issued! 🎓', `Certificate #${newCert.certificate_number} generated.`);
      setSelectedCert(newCert);
    },
    onError: (err: any) => {
      toastError('Claim Failed', err.message);
    },
  });

  const issuedCourseIds = new Set(certificates.map((c) => c.course_id));
  const unclaimedCompleted = enrollments.filter(
    (e) => e.status === 'COMPLETED' && !issuedCourseIds.has(e.course_id)
  );

  const learnerFullName = profile?.full_name || 'Learner';

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Certificates & Credentials"
        description="View, print, download, and verify your official DataCaliper competency certificates."
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
            {certificates.length} Earned
          </span>
        }
      />

      {/* Unclaimed Certificates Alert */}
      {unclaimedCompleted.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-600 to-primary text-white p-6 rounded-2xl shadow-card space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-100">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Course Completed — Ready for Credential</span>
          </div>
          <h2 className="text-xl font-bold">You have completed {unclaimedCompleted.length} course(s)!</h2>
          <p className="text-xs text-indigo-100 max-w-xl">
            Claim your official certificate of completion with verified cryptographic hash.
          </p>

          <div className="pt-2 flex gap-3 flex-wrap">
            {unclaimedCompleted.map((enr) => (
              <Button
                key={enr.course_id}
                size="sm"
                className="bg-white text-primary hover:bg-indigo-50 border-transparent shadow-sm"
                isLoading={claimMutation.isPending}
                onClick={() => claimMutation.mutate(enr.course_id)}
                leftIcon={<Award className="w-4 h-4 text-amber-600" />}
              >
                Claim: {enr.course?.title || 'Course Certificate'}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Issued Certificates Grid */}
      {loadingCerts ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : certificates.length === 0 && unclaimedCompleted.length === 0 ? (
        <EmptyState
          icon={<Award className="w-12 h-12 text-amber-500" />}
          title="No Certificates Earned Yet"
          description="Complete all required module lessons and pass the final course assessment to earn your official credentials."
          actionLabel="Explore Courses"
          onAction={() => window.location.assign('/learner/discover')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="bg-white rounded-2xl border border-border shadow-card p-6 flex flex-col justify-between hover:shadow-card-hover transition-all space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Verified Credential
                  </span>
                  <Award className="w-6 h-6 text-[#c59b27]" />
                </div>

                <h3 className="text-lg font-bold text-charcoal">{cert.course_title || cert.course?.title || 'Certificate of Completion'}</h3>

                <div className="space-y-1 text-xs text-charcoal-muted">
                  <p>
                    Recipient: <strong className="text-charcoal">{cert.student_name || learnerFullName}</strong>
                  </p>
                  <p>
                    Issued Date:{' '}
                    <strong>
                      {new Date(cert.issued_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </strong>
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] font-mono text-slate-700 truncate border border-slate-200 flex items-center justify-between">
                  <span>ID: {cert.certificate_number}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/80 flex items-center justify-between gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedCert(cert)}
                  leftIcon={<Eye className="w-3.5 h-3.5" />}
                >
                  View Certificate
                </Button>

                <a
                  href={`/verify-certificate/${cert.certificate_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <span>Public Verification</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Professional Certificate Viewer Modal */}
      {selectedCert && (
        <Modal
          isOpen={Boolean(selectedCert)}
          onClose={() => setSelectedCert(null)}
          size="xl"
          title="Official Certificate of Completion"
        >
          <div className="space-y-6">
            {/* Certificate Preview Document */}
            <div className="overflow-x-auto py-2">
              <ProfessionalCertificate
                studentName={selectedCert.student_name || learnerFullName}
                courseTitle={selectedCert.course_title || selectedCert.course?.title || 'Course Certificate'}
                certificateNumber={selectedCert.certificate_number}
                issuedAt={selectedCert.issued_at}
                verificationHash={selectedCert.verification_hash}
                instructorName={selectedCert.instructor_name || 'Course Faculty'}
              />
            </div>

            {/* Action Buttons Toolbar */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
              <div className="text-xs text-slate-500">
                <span>Unique Credential ID: </span>
                <span className="font-mono font-bold text-slate-800">{selectedCert.certificate_number}</span>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={`/verify-certificate/${selectedCert.certificate_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-print"
                >
                  <Button size="sm" variant="outline" leftIcon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}>
                    Verify Authenticity
                  </Button>
                </a>

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
      )}
    </div>
  );
};
