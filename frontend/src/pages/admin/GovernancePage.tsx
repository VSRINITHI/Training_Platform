import React from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, BookOpen } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';

export const GovernancePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Governance & Policy Oversight"
        description="Review security enforcement, RBAC policies, and integrity checks."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-border shadow-card space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-base">
            <ShieldCheck className="w-5 h-5" />
            <span>Role-Based Access Control (RBAC)</span>
          </div>
          <p className="text-xs text-charcoal-muted leading-relaxed">
            Strict authorization boundaries are enforced at the API layer. Learners cannot author content, and instructors can only modify courses and quizzes they own.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-border shadow-card space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-base">
            <CheckCircle2 className="w-5 h-5" />
            <span>AI Quarantine Isolation Gate</span>
          </div>
          <p className="text-xs text-charcoal-muted leading-relaxed">
            All AI-generated questions must pass through human-in-the-loop review before entering the learner-accessible assessment pool.
          </p>
        </div>
      </div>
    </div>
  );
};
