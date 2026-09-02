import React from 'react';
import { Award, ShieldCheck, CheckCircle2 } from 'lucide-react';

export interface ProfessionalCertificateProps {
  studentName: string;
  courseTitle: string;
  certificateNumber: string;
  issuedAt: string;
  verificationHash?: string;
  instructorName?: string;
  organizationName?: string;
  className?: string;
}

export const ProfessionalCertificate: React.FC<ProfessionalCertificateProps> = ({
  studentName,
  courseTitle,
  certificateNumber,
  issuedAt,
  verificationHash,
  instructorName = 'Course Faculty & Academic Board',
  organizationName = 'DataCaliper Training Platform',
  className = '',
}) => {
  const formattedDate = new Date(issuedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const verificationUrl = `${window.location.origin}/verify-certificate/${certificateNumber}`;

  return (
    <div
      className={`certificate-print-container relative w-full max-w-4xl mx-auto bg-white p-4 sm:p-6 select-none ${className}`}
    >
      {/* Outer Certificate Frame with Luxury Gold/Navy Multi-line Border */}
      <div className="certificate-print-frame relative w-full bg-gradient-to-br from-[#faf8f5] via-white to-[#f8f9fa] border-[10px] border-[#0f2444] p-6 sm:p-10 shadow-2xl rounded-sm overflow-hidden">
        {/* Inner Accent Gold Border */}
        <div className="absolute inset-2 border-2 border-[#c59b27]/70 pointer-events-none rounded-[1px]" />
        <div className="absolute inset-3.5 border border-[#0f2444]/20 pointer-events-none" />

        {/* Decorative Corner Filigrees */}
        <div className="absolute top-4 left-4 w-10 h-10 border-t-2 border-l-2 border-[#c59b27] pointer-events-none" />
        <div className="absolute top-4 right-4 w-10 h-10 border-t-2 border-r-2 border-[#c59b27] pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 border-[#c59b27] pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-[#c59b27] pointer-events-none" />

        {/* Background Watermark Crest */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none">
          <div className="w-96 h-96 rounded-full border-[24px] border-[#0f2444] flex items-center justify-center">
            <span className="text-8xl font-serif font-black tracking-widest text-[#0f2444]">DC</span>
          </div>
        </div>

        {/* Certificate Content */}
        <div className="relative z-10 flex flex-col items-center text-center justify-between min-h-[500px] sm:min-h-[540px]">
          {/* Top Brand Header */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#0f2444] text-[#c59b27] flex items-center justify-center shadow-sm">
                <span className="font-serif font-bold text-sm">DC</span>
              </div>
              <span className="font-serif text-lg sm:text-xl font-bold tracking-[0.25em] text-[#0f2444] uppercase">
                DataCaliper
              </span>
            </div>
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-[#c59b27]">
              Training Platform • Executive Credentials
            </p>
          </div>

          {/* Certificate Title */}
          <div className="my-3 space-y-1">
            <h1 className="font-serif text-2xl sm:text-4xl font-extrabold text-[#0f2444] tracking-wide uppercase">
              Certificate of Completion
            </h1>
            <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-[#c59b27] to-transparent mx-auto" />
            <p className="text-xs sm:text-sm font-serif italic text-slate-600 pt-1">
              This is officially presented to acknowledge that
            </p>
          </div>

          {/* Learner Name Section */}
          <div className="my-2 py-2 px-6 border-b-2 border-[#0f2444]/20 min-w-[280px] max-w-xl">
            <h2 className="font-serif text-2xl sm:text-4xl font-black text-[#0f2444] tracking-tight uppercase">
              {studentName || 'Learner'}
            </h2>
          </div>

          {/* Course Achievement Statement */}
          <div className="max-w-2xl px-4 space-y-1.5 my-2">
            <p className="text-xs sm:text-sm text-slate-700 font-sans leading-relaxed">
              has successfully completed all required modules, checkpoints, and the final assessment for
            </p>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1e3a8a] leading-snug">
              {courseTitle}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 font-sans leading-relaxed">
              demonstrating verified competency, academic rigor, and professional mastery through the DataCaliper curriculum.
            </p>
          </div>

          {/* Signatures & Seal Section */}
          <div className="w-full pt-6 pb-2 px-4 sm:px-8 grid grid-cols-3 items-end gap-4 text-center">
            {/* Left Signature: Academic Platform */}
            <div className="space-y-1 text-left sm:text-center">
              <div className="h-9 flex items-end justify-center">
                <span className="font-serif italic text-base sm:text-lg font-bold text-[#0f2444] tracking-wider font-signature">
                  DataCaliper Board
                </span>
              </div>
              <div className="w-full h-px bg-[#0f2444]/30" />
              <p className="text-[11px] font-bold text-[#0f2444]">Academic Director</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">{organizationName}</p>
            </div>

            {/* Center: Gold Foil Seal */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-[#997316] via-[#c59b27] to-[#e6ca65] p-1 shadow-md flex items-center justify-center">
                <div className="w-full h-full rounded-full border border-white/50 bg-[#0f2444] flex flex-col items-center justify-center text-white text-center p-1">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#c59b27]" />
                  <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider mt-0.5 text-[#fef3c7]">
                    Verified
                  </span>
                  <span className="text-[6px] sm:text-[7px] text-slate-300">Credential</span>
                </div>
              </div>
            </div>

            {/* Right Signature: Instructor */}
            <div className="space-y-1 text-right sm:text-center">
              <div className="h-9 flex items-end justify-center">
                <span className="font-serif italic text-base sm:text-lg font-bold text-[#1e3a8a] tracking-wider font-signature">
                  {instructorName}
                </span>
              </div>
              <div className="w-full h-px bg-[#0f2444]/30" />
              <p className="text-[11px] font-bold text-[#0f2444]">Course Instructor</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Subject Matter Faculty</p>
            </div>
          </div>

          {/* Bottom Metadata & Verification Bar */}
          <div className="w-full pt-3 mt-2 border-t border-[#c59b27]/30 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-600 gap-2 px-2">
            <div className="flex items-center gap-4">
              <div>
                <span className="font-bold text-slate-700">Certificate ID: </span>
                <span className="font-mono font-bold text-[#0f2444]">{certificateNumber}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700">Issue Date: </span>
                <span>{formattedDate}</span>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <span className="text-[9px] text-slate-500">Verify at: </span>
              <span className="font-mono font-semibold text-[#1e3a8a]">{verificationUrl}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
