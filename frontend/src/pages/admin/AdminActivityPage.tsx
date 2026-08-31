import React from 'react';
import { Activity, Clock } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';

export const AdminActivityPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Platform Activity"
        description="Audit logs for content modifications, role promotions, and curriculum events."
      />

      <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-border text-center space-y-2">
        <Activity className="w-10 h-10 text-slate-400 mx-auto" />
        <h4 className="text-base font-bold text-charcoal">Audit Activity Stream</h4>
        <p className="text-xs text-charcoal-muted max-w-md mx-auto">
          Audit stream for administrative actions and role updates will stream here once audit endpoints are enabled.
        </p>
      </div>
    </div>
  );
};
