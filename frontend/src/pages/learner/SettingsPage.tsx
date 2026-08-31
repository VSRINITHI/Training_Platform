import React from 'react';
import { Shield, Bell, Key, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Toggle } from '../../components/ui/Toggle';

export const SettingsPage: React.FC = () => {
  const { signOut, profile } = useAuth();
  const [emailNotifs, setEmailNotifs] = React.useState(true);
  const [courseUpdates, setCourseUpdates] = React.useState(true);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Account Settings"
        description="Manage your account preferences, notifications, and security credentials."
      />

      {/* Security & Authentication */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-card space-y-4">
        <h3 className="text-base font-bold text-charcoal flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <span>Security & Authentication</span>
        </h3>
        <p className="text-xs text-charcoal-muted">
          Your credentials and identity sessions are managed securely by Supabase Authentication.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/60">
          <div>
            <p className="text-xs font-semibold text-charcoal">Password Reset</p>
            <p className="text-[11px] text-charcoal-muted">Request a secure password reset link to your email</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => alert('Password reset link sent to ' + profile?.email)}
          >
            Reset Password
          </Button>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-card space-y-4">
        <h3 className="text-base font-bold text-charcoal flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <span>Notification Preferences</span>
        </h3>

        <div className="space-y-3 pt-2">
          <Toggle
            checked={emailNotifs}
            onChange={setEmailNotifs}
            label="Assessment & Quiz Results"
            description="Receive email confirmations when quizzes are evaluated and scored."
          />
          <div className="border-t border-border/40 pt-3">
            <Toggle
              checked={courseUpdates}
              onChange={setCourseUpdates}
              label="Course & Curriculum Updates"
              description="Receive notifications when new modules or certificates become available."
            />
          </div>
        </div>
      </div>

      {/* Session Management */}
      <div className="bg-white p-6 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-card flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-rose-800">Sign Out of Session</h4>
          <p className="text-xs text-slate-500">Terminate your current authenticated session.</p>
        </div>
        <Button variant="danger" size="sm" onClick={() => signOut()} leftIcon={<LogOut className="w-4 h-4" />}>
          Sign Out
        </Button>
      </div>
    </div>
  );
};
