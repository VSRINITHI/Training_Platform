import React from 'react';
import { BarChart3, Activity } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';

export const AdminReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Platform Reports"
        description="System-wide completion trends, enrollment analytics, and platform throughput."
      />

      <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-border text-center space-y-2">
        <BarChart3 className="w-10 h-10 text-slate-400 mx-auto" />
        <h4 className="text-base font-bold text-charcoal">Platform Reporting Engine</h4>
        <p className="text-xs text-charcoal-muted max-w-md mx-auto">
          Comprehensive cross-cohort reports and platform trends will be displayed as backend reporting aggregations are configured.
        </p>
      </div>
    </div>
  );
};
