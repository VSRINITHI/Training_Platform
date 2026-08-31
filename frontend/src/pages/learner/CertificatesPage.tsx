import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, CheckCircle, ShieldCheck, Download, ExternalLink, Sparkles } from 'lucide-react';
import { certificatesApi } from '../../api/certificates';
import { progressApi } from '../../api/progress';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Certificate } from '../../types';

export const CertificatesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);

  // 1. Fetch user's certificates
  const { data: certificates = [], isLoading: loadingCerts } = useQuery({
    queryKey: ['my-certificates'],
    queryFn: certificatesApi.getMyCertificates,
  });

  // 2. Fetch completed enrollments that might be eligible to claim
  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Certificates"
        description="View, download, and share your verified competency certificates and credentials."
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
            {certificates.length} Issued
          </span>
        }
      />

      {/* Unclaimed Certificates Alert */}
      {unclaimedCompleted.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-500 to-primary text-white p-6 rounded-2xl shadow-card space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-100">
            <Sparkles className="w-4 h-4" />
            <span>Eligible for Issuance</span>
          </div>
          <h2 className="text-xl font-bold">You have completed {unclaimedCompleted.length} course(s)!</h2>
          <p className="text-xs text-indigo-100 max-w-xl">
            Claim your official verified certificate with unique credential hash and audit verification.
          </p>

          <div className="pt-2 flex gap-3 flex-wrap">
            {unclaimedCompleted.map((enr) => (
              <Button
                key={enr.course_id}
                size="sm"
                className="bg-white text-primary hover:bg-indigo-50 border-transparent shadow-sm"
                isLoading={claimMutation.isPending}
                onClick={() => claimMutation.mutate(enr.course_id)}
                leftIcon={<Award className="w-4 h-4" />}
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
          description="Complete all required module lessons and pass the final certification assessment to earn your official credentials."
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Credential
                  </span>
                  <Award className="w-6 h-6 text-amber-500" />
                </div>

                <h3 className="text-lg font-bold text-charcoal">{cert.course?.title || 'Certificate of Completion'}</h3>
                <p className="text-xs text-charcoal-muted">
                  Issued: <strong>{new Date(cert.issued_at).toLocaleDateString()}</strong>
                </p>

                <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] font-mono text-slate-600 truncate border border-slate-200">
                  Cert ID: {cert.certificate_number}
                </div>
              </div>

              <div className="pt-3 border-t border-border/80 flex items-center justify-between gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedCert(cert)}
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                >
                  View Credential
                </Button>

                <a
                  href={`/api/v1/certificates/verify/${cert.verification_hash}`}
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

      {/* Certificate Viewer Modal */}
      {selectedCert && (
        <Modal
          isOpen={Boolean(selectedCert)}
          onClose={() => setSelectedCert(null)}
          size="lg"
          title="Certificate of Competency"
        >
          <div className="p-6 bg-gradient-to-br from-slate-50 via-white to-amber-50/30 rounded-xl border-2 border-amber-300 text-center space-y-4 shadow-sm my-2">
            <div className="flex justify-center">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-full">
                <Award className="w-10 h-10" />
              </div>
            </div>

            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-slate-500">
                DataCaliper Training Platform
              </p>
              <h2 className="text-2xl font-extrabold text-charcoal mt-1">Certificate of Completion</h2>
              <p className="text-xs text-charcoal-muted mt-1">This is officially certified to acknowledge that</p>
            </div>

            <div className="py-2 border-y border-amber-200">
              <h3 className="text-xl font-bold text-primary">{selectedCert.course?.title}</h3>
              <p className="text-xs text-charcoal-muted mt-0.5">has been successfully mastered and verified.</p>
            </div>

            <div className="grid grid-cols-2 text-xs text-charcoal-muted text-left max-w-md mx-auto pt-2">
              <div>
                <span>Certificate Number:</span>
                <p className="font-mono font-bold text-charcoal">{selectedCert.certificate_number}</p>
              </div>
              <div>
                <span>Issue Date:</span>
                <p className="font-bold text-charcoal">
                  {new Date(selectedCert.issued_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-center">
              <Button size="sm" onClick={() => window.print()} leftIcon={<Download className="w-3.5 h-3.5" />}>
                Print / Save PDF
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
