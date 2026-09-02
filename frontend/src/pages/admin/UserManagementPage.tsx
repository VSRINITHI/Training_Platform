import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  UserPlus,
  Send,
  RotateCw,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Shield,
  GraduationCap,
  Search,
  Filter,
  RefreshCw,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { UserRole, UserInvitation, UserProfile, InvitationStatus } from '../../types';

export const UserManagementPage: React.FC = () => {
  const { profile: currentAdminProfile } = useAuth();
  const { success, warning, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'invitations' | 'users'>('invitations');

  // Invitation Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'USER' | 'INSTRUCTOR'>('INSTRUCTOR');

  // Invitations Filter State
  const [invitationSearch, setInvitationSearch] = useState('');
  const [invitationStatusFilter, setInvitationStatusFilter] = useState<string>('ALL');

  // Users Directory Filter State
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // Inline role update state for existing users
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // User deletion state
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  // Query: Invitations
  const {
    data: invitationsData,
    isLoading: isLoadingInvitations,
    refetch: refetchInvitations,
  } = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: () => authApi.listInvitations(),
  });

  // Query: Platform Users
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin-users', userSearch, userRoleFilter],
    queryFn: () =>
      authApi.listUsers({
        search: userSearch.trim() || undefined,
        role: userRoleFilter !== 'ALL' ? (userRoleFilter as UserRole) : undefined,
      }),
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  // Mutation: Send Invitation
  const sendInviteMutation = useMutation({
    mutationFn: (payload: { email: string; role: 'USER' | 'INSTRUCTOR' }) =>
      authApi.inviteUser(payload),
    onSuccess: (data) => {
      if (data.email_sent === false) {
        warning(
          'Account Created (Email Warning) ⚠️',
          `Invitation created in Supabase for ${data.email}, but email delivery failed (${data.email_error || 'Check server SMTP settings'}).`
        );
      } else {
        success(
          'Invitation Sent! ✉️',
          `An invitation email has been sent to ${data.email} as ${data.role}.`
        );
      }
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (err: any) => {
      toastError('Invitation Failed', err.message || 'Failed to send invitation');
    },
  });

  // Mutation: Resend Invitation
  const resendInviteMutation = useMutation({
    mutationFn: (invitationId: string) => authApi.resendInvitation(invitationId),
    onSuccess: (data) => {
      if (data.email_sent === false) {
        warning(
          'Link Generated (Email Warning) ⚠️',
          `Fresh link generated for ${data.email}, but email delivery failed (${data.email_error || 'Check server SMTP settings'}).`
        );
      } else {
        success('Invitation Resent! 🔄', `Fresh invitation link sent to ${data.email}.`);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (err: any) => {
      toastError('Resend Failed', err.message || 'Failed to resend invitation');
    },
  });

  // Mutation: Cancel Invitation
  const cancelInviteMutation = useMutation({
    mutationFn: (invitationId: string) => authApi.cancelInvitation(invitationId),
    onSuccess: (data) => {
      success('Invitation Cancelled', data.message);
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (err: any) => {
      toastError('Cancellation Failed', err.message || 'Failed to cancel invitation');
    },
  });

  // Mutation: Update Existing User Role
  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      authApi.assignRole(userId, role),
    onSuccess: (updatedUser) => {
      success(
        'Role Updated! 🛡️',
        `${updatedUser.full_name || updatedUser.email} is now ${updatedUser.role}.`
      );
      setUpdatingUserId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => {
      toastError('Role Update Failed', err.message || 'Failed to update role');
      setUpdatingUserId(null);
    },
  });

  // Mutation: Delete User Account
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => authApi.deleteUser(userId),
    onSuccess: () => {
      success(
        'User Deleted',
        `User account "${userToDelete?.email}" and all associated records were permanently deleted.`
      );
      setUserToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-courses-oversight'] });
    },
    onError: (err: any) => {
      toastError('Delete Failed', err.message || 'Failed to delete user account');
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail) return;
    sendInviteMutation.mutate({ email: cleanEmail, role: inviteRole });
  };

  const handleRoleChangeForUser = (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    updateUserRoleMutation.mutate({ userId, role: newRole });
  };

  // Filtered invitations list
  const invitations = invitationsData?.invitations || [];
  const filteredInvitations = invitations.filter((inv) => {
    const matchesSearch =
      !invitationSearch || inv.email.toLowerCase().includes(invitationSearch.toLowerCase());
    const matchesStatus =
      invitationStatusFilter === 'ALL' || inv.status === invitationStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Status Badge Helper
  const getStatusBadge = (status: InvitationStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">Pending Activation</Badge>;
      case 'ACCEPTED':
        return <Badge variant="success">Accepted</Badge>;
      case 'EXPIRED':
        return <Badge variant="default">Expired</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      case 'FAILED':
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="User & Staff Management"
        description="Invite new instructors and learners via branded emails, track invitation status, and manage active platform members."
      />

      {/* ── 1. Invite User Card (Primary Workflow) ─────────────────────────── */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-charcoal flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              <span>Invite New User to DataCaliper</span>
            </h3>
            <p className="text-xs sm:text-sm text-charcoal-muted">
              Enter an email address and choose an access level. The user will receive a branded
              invitation email to activate their account and set their password.
            </p>
          </div>
        </div>

        <form onSubmit={handleSendInvite} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Email Address Input */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="block text-xs font-semibold text-charcoal">
              Recipient Email Address <span className="text-rose-500">*</span>
            </label>
            <Input
              type="email"
              placeholder="e.g. instructor@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>

          {/* Role Dropdown (USER or INSTRUCTOR only - ADMIN explicitly excluded) */}
          <div className="md:col-span-4 space-y-1.5">
            <Select
              label="Assigned Role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'USER' | 'INSTRUCTOR')}
            >
              <option value="INSTRUCTOR">INSTRUCTOR — Course &amp; Curriculum Author</option>
              <option value="USER">USER — Standard Learner</option>
            </Select>
          </div>

          {/* Send Button */}
          <div className="md:col-span-2">
            <Button
              type="submit"
              size="md"
              className="w-full"
              isLoading={sendInviteMutation.isPending}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Send Invite
            </Button>
          </div>
        </form>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-border text-xs text-charcoal-muted flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary shrink-0" />
          <span>
            <strong>Secure server dispatch:</strong> The invitation link is securely generated via Supabase Admin API and delivered directly via SMTP. No passwords are created by the Admin.
          </span>
        </div>
      </div>

      {/* ── 2. Unified Management Section ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-border bg-slate-50/70 px-6 pt-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('invitations')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'invitations'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-charcoal-muted hover:text-charcoal'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Invitations Log</span>
              {invitations.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-charcoal font-semibold">
                  {invitations.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-charcoal-muted hover:text-charcoal'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Platform Members Directory</span>
              {usersData && usersData.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-charcoal font-semibold">
                  {usersData.length}
                </span>
              )}
            </button>
          </div>

          <div className="pb-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (activeTab === 'invitations') refetchInvitations();
                else refetchUsers();
              }}
              leftIcon={<RotateCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* ── TAB 1: Invitations Log ────────────────────────────────────────── */}
        {activeTab === 'invitations' && (
          <div className="p-6 space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2">
              <div className="w-full sm:w-80">
                <SearchInput
                  placeholder="Filter by recipient email..."
                  value={invitationSearch}
                  onChange={(e) => setInvitationSearch(e.target.value)}
                  onClear={() => setInvitationSearch('')}
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                <Select
                  value={invitationStatusFilter}
                  onChange={(e) => setInvitationStatusFilter(e.target.value)}
                  className="text-xs py-1.5"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Activation</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </div>
            </div>

            {/* Invitations Table */}
            {isLoadingInvitations ? (
              <div className="p-12 text-center text-charcoal-muted text-sm">
                <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                Loading invitations log...
              </div>
            ) : filteredInvitations.length === 0 ? (
              <div className="p-12 text-center text-charcoal-muted space-y-2">
                <Mail className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm font-medium">No invitations match your filter.</p>
                <p className="text-xs">Use the form above to invite a new instructor or learner.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-charcoal-muted font-semibold border-b border-border">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Recipient Email</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Invited Date</th>
                      <th className="py-3.5 px-4">Expires In</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredInvitations.map((inv) => {
                      const expiresDate = new Date(inv.expires_at);
                      const isExpired = expiresDate < new Date();
                      const daysLeft = Math.ceil(
                        (expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 sm:px-6">
                            <p className="font-semibold text-charcoal">{inv.email}</p>
                            {inv.invited_by && (
                              <p className="text-[11px] text-charcoal-muted">
                                By {inv.invited_by.full_name || inv.invited_by.email}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              variant={inv.role === 'INSTRUCTOR' ? 'primary' : 'default'}
                            >
                              {inv.role}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4">{getStatusBadge(inv.status)}</td>
                          <td className="py-3.5 px-4 text-charcoal-muted text-xs">
                            {new Date(inv.invited_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {inv.status === 'ACCEPTED' ? (
                              <span className="text-emerald-600 font-medium">Activated</span>
                            ) : inv.status === 'CANCELLED' ? (
                              <span className="text-rose-500">Revoked</span>
                            ) : isExpired ? (
                              <span className="text-rose-500 font-semibold">Expired</span>
                            ) : (
                              <span className="text-amber-600 font-medium">{daysLeft} days left</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {inv.status === 'PENDING' && !isExpired && (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs px-2.5 py-1"
                                  isLoading={resendInviteMutation.isPending}
                                  onClick={() => resendInviteMutation.mutate(inv.id)}
                                  title="Generate new link and resend email"
                                >
                                  Resend
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-rose-600 hover:bg-rose-50 text-xs px-2 py-1"
                                  isLoading={cancelInviteMutation.isPending}
                                  onClick={() => cancelInviteMutation.mutate(inv.id)}
                                  title="Cancel invitation"
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Platform Members Directory ─────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="p-6 space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2">
              <div className="w-full sm:w-80">
                <SearchInput
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onClear={() => setUserSearch('')}
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="text-xs py-1.5"
                >
                  <option value="ALL">All Roles</option>
                  <option value="USER">USER (Learners)</option>
                  <option value="INSTRUCTOR">INSTRUCTOR (Instructors)</option>
                  <option value="ADMIN">ADMIN (Administrators)</option>
                </Select>
              </div>
            </div>

            {/* Users Table */}
            {isLoadingUsers ? (
              <div className="p-12 text-center text-charcoal-muted text-sm">
                <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                Loading platform members...
              </div>
            ) : !usersData || usersData.length === 0 ? (
              <div className="p-12 text-center text-charcoal-muted space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm font-medium">No platform users found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-charcoal-muted font-semibold border-b border-border">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">User Email &amp; Name</th>
                      <th className="py-3.5 px-4">Current Role</th>
                      <th className="py-3.5 px-4">Joined Date</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {usersData.map((u: UserProfile) => {
                      const isSelf = u.id === currentAdminProfile?.id;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-primary text-xs uppercase shrink-0">
                                {u.full_name?.charAt(0) || u.email?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <p className="font-semibold text-charcoal">
                                  {u.full_name || 'No Name'}
                                  {isSelf && (
                                    <span className="ml-2 text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                                      You
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-charcoal-muted">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              variant={
                                u.role === 'ADMIN'
                                  ? 'danger'
                                  : u.role === 'INSTRUCTOR'
                                  ? 'primary'
                                  : 'default'
                              }
                            >
                              {u.role}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-charcoal-muted text-xs">
                            {u.created_at
                              ? new Date(u.created_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Inline Role Reassignment */}
                              <Select
                                value={u.role}
                                disabled={updatingUserId === u.id || isSelf}
                                onChange={(e) =>
                                  handleRoleChangeForUser(u.id, e.target.value as UserRole)
                                }
                                className="text-xs py-1 px-2 w-36"
                              >
                                <option value="USER">USER (Learner)</option>
                                <option value="INSTRUCTOR">INSTRUCTOR</option>
                                <option value="ADMIN">ADMIN</option>
                              </Select>

                              {/* Delete User Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 p-1.5"
                                disabled={isSelf}
                                onClick={() => setUserToDelete(u)}
                                title={
                                  isSelf
                                    ? 'Administrators cannot delete their own account'
                                    : `Delete user ${u.email}`
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 3. Delete User Confirmation Dialog ─────────────────────────────── */}
      {userToDelete && (
        <ConfirmDialog
          isOpen={Boolean(userToDelete)}
          onClose={() => setUserToDelete(null)}
          onConfirm={() => deleteUserMutation.mutate(userToDelete.id)}
          title="Delete User Account"
          message={`Are you sure you want to permanently delete the account for "${userToDelete.email}" (${userToDelete.role})?\n\nThis will permanently remove their user record from the database, delete their Supabase Auth credentials, and clean up all associated enrollments, attempts, certificates, and authored courses. This action CANNOT be undone.`}
          confirmLabel="Delete User Account"
          isLoading={deleteUserMutation.isPending}
        />
      )}

      {/* ── 4. Role Information Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-border space-y-1.5 shadow-sm">
          <span className="text-xs font-bold text-charcoal flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            USER (Learner)
          </span>
          <p className="text-xs text-charcoal-muted leading-relaxed">
            Standard learner account. Can discover courses, enroll, track curriculum progress, take quizzes, and earn certificates.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border space-y-1.5 shadow-sm">
          <span className="text-xs font-bold text-primary flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            INSTRUCTOR
          </span>
          <p className="text-xs text-charcoal-muted leading-relaxed">
            Educator and course creator. Can build curriculum, write lessons, manage quizzes, and review AI question drafts.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border space-y-1.5 shadow-sm">
          <span className="text-xs font-bold text-rose-600 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            ADMIN
          </span>
          <p className="text-xs text-charcoal-muted leading-relaxed">
            System governance. Can manage domains/sub-domains, oversee all platform courses, and send user invitations.
          </p>
        </div>
      </div>
    </div>
  );
};
