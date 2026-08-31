import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Users, Shield, ShieldAlert, GraduationCap, UserCheck, Search, Check } from 'lucide-react';
import { authApi } from '../../api/auth';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { UserRole } from '../../types';

export const UserManagementPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [userId, setUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('INSTRUCTOR');
  const [lastAssigned, setLastAssigned] = useState<{ id: string; role: UserRole; email?: string } | null>(null);

  // Assign Role Mutation
  const assignRoleMutation = useMutation({
    mutationFn: () => authApi.assignRole(userId.trim(), selectedRole),
    onSuccess: (updatedUser) => {
      success('Role Updated! 🛡️', `User ${updatedUser.full_name || updatedUser.email} is now ${updatedUser.role}.`);
      setLastAssigned({
        id: updatedUser.id,
        role: updatedUser.role,
        email: updatedUser.email,
      });
      setUserId('');
    },
    onError: (err: any) => {
      toastError('Role Assignment Failed', err.message);
    },
  });

  const handleRoleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;
    assignRoleMutation.mutate();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="User & Staff Role Management"
        description="Promote or reassign user roles across the platform (Learner, Instructor, Administrator)."
      />

      {/* Role Assignment Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-6">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-charcoal flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <span>Assign Role by User Identifier</span>
          </h3>
          <p className="text-xs text-charcoal-muted">
            Provide the target user's UUID to update their platform access level.
          </p>
        </div>

        <form onSubmit={handleRoleAssign} className="space-y-4">
          <Input
            label="Target User UUID"
            placeholder="e.g. 11111111-1111-1111-1111-111111111111"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            helperText="The user's UUID from public.users or their authentication profile."
          />

          <Select
            label="Assigned Role"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
          >
            <option value="USER">USER (Standard Learner)</option>
            <option value="INSTRUCTOR">INSTRUCTOR (Course & Curriculum Author)</option>
            <option value="ADMIN">ADMIN (Full Platform Governance & Taxonomy)</option>
          </Select>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              size="md"
              isLoading={assignRoleMutation.isPending}
              disabled={!userId.trim()}
              leftIcon={<UserCheck className="w-4 h-4" />}
            >
              Update User Role
            </Button>
          </div>
        </form>

        {/* Feedback on Last Assigned */}
        {lastAssigned && (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>
                User <strong>{lastAssigned.email || lastAssigned.id}</strong> role changed to{' '}
                <strong>{lastAssigned.role}</strong>.
              </span>
            </div>
            <Badge variant="success">{lastAssigned.role}</Badge>
          </div>
        )}
      </div>

      {/* Role Explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-border space-y-1">
          <span className="text-xs font-bold text-charcoal flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            USER (Learner)
          </span>
          <p className="text-[11px] text-charcoal-muted leading-relaxed">
            Discover courses, enroll, complete lessons, take quizzes, and earn certificates.
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-border space-y-1">
          <span className="text-xs font-bold text-primary flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            INSTRUCTOR
          </span>
          <p className="text-[11px] text-charcoal-muted leading-relaxed">
            Author courses, build curriculums, configure assessments, and review AI drafts.
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-border space-y-1">
          <span className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-600" />
            ADMIN
          </span>
          <p className="text-[11px] text-charcoal-muted leading-relaxed">
            Manage subject taxonomy, promote roles, and oversee all platform courses.
          </p>
        </div>
      </div>
    </div>
  );
};
