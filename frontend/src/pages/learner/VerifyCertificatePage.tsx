import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, XCircle, Search, Award, CheckCircle, ArrowLeft, Calendar, User, BookOpen } from 'lucide-react';
import { certificatesApi } from '../../api/certificates';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';

export const VerifyCertificatePage: React.FC = () => {
  const { certificateNumber } = useParams<{ certificateNumber?: string }>();
  const [queryInput, setQueryInput] = useState(certificateNumber || '');
  const [searchedId, setSearchedId] = useState(certificateNumber || '');

  useEffect(() => {
    if (certificateNumber) {
      setQueryInput(certificateNumber);
      setSearchedId(certificateNumber);
    }
  }, [certificateNumber]);

  const { data: verificationResult, isLoading, isError } = useQuery({
    queryKey: ['verify-certificate', searchedId],
    queryFn: () => certificatesApi.verify(searchedId),
    enabled: Boolean(searchedId.trim()),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryInput.trim()) {
      setSearchedId(queryInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 sm:px-12 flex items-center justify-between shadow-sm">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0f2444] text-[#c59b27] flex items-center justify-center font-serif font-bold text-sm">
            DC
          </div>
          <span className="font-serif text-lg font-bold tracking-wider text-[#0f2444] uppercase">
            DataCaliper
          </span>
        </Link>
        <Link to="/learner">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Back to Platform
          </Button>
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl w-full mx-auto px-4 py-12 space-y-8 flex-1">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-indigo-50 text-primary mb-2">
            <ShieldCheck className="w-8 h-8 text-[#0f2444]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#0f2444]">
            Certificate Credential Verification
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Verify the authenticity of DataCaliper Training Platform issued course certificates and academic credentials.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-2">
          <Input
            placeholder="Enter Certificate ID (e.g. DC-2026-XXXXXX)"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="flex-1 font-mono text-sm"
          />
          <Button type="submit" size="md" leftIcon={<Search className="w-4 h-4" />}>
            Verify
          </Button>
        </form>

        {/* Verification Result */}
        {isLoading && <LoadingState message="Verifying certificate cryptographic hash..." className="py-12" />}

        {searchedId && !isLoading && verificationResult && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 sm:p-8 space-y-6 animate-fadeIn">
            {verificationResult.is_valid ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                  <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm sm:text-base">Official Verified Certificate</h3>
                    <p className="text-xs text-emerald-700">
                      This certificate is authentic and recorded in the DataCaliper registry.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Recipient Name</span>
                    </div>
                    <p className="font-bold text-base text-slate-900 font-serif">
                      {verificationResult.student_name || 'Learner'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      <span>Course Completed</span>
                    </div>
                    <p className="font-bold text-base text-[#1e3a8a]">
                      {verificationResult.course_title || 'Course'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <Award className="w-3.5 h-3.5 text-slate-400" />
                      <span>Certificate Number</span>
                    </div>
                    <p className="font-mono font-bold text-sm text-slate-800">
                      {verificationResult.certificate_number}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Issue Date</span>
                    </div>
                    <p className="font-semibold text-sm text-slate-800">
                      {verificationResult.issued_at
                        ? new Date(verificationResult.issued_at).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="text-center pt-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Verification Digest: {verificationResult.verification_hash}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <XCircle className="w-12 h-12 text-rose-500 mx-auto" />
                <h3 className="text-lg font-bold text-slate-900">Certificate Not Found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No verified credential matches the identifier <strong className="font-mono">{searchedId}</strong>. Please check the certificate number and retry.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200">
        © {new Date().getFullYear()} DataCaliper Training Platform. All rights reserved.
      </footer>
    </div>
  );
};
