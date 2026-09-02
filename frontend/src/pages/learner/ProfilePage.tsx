import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Mail, Shield, BookOpen, Save, Sparkles, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth';
import { domainsApi } from '../../api/domains';
import { interestsApi } from '../../api/interests';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';

interface ProfileFormData {
  full_name: string;
  avatar_url?: string;
}

export const ProfilePage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [selectedSubDomainIds, setSelectedSubDomainIds] = useState<string[]>([]);

  const { register, handleSubmit, reset } = useForm<ProfileFormData>({
    defaultValues: {
      full_name: profile?.full_name || '',
      avatar_url: profile?.avatar_url || '',
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name,
        avatar_url: profile.avatar_url || '',
      });
    }
  }, [profile, reset]);

  // Fetch Domains
  const { data: domains = [] } = useQuery({
    queryKey: ['profile-domains'],
    queryFn: domainsApi.list,
  });

  // Fetch current interests
  const { data: currentInterests = [] } = useQuery({
    queryKey: ['my-interests'],
    queryFn: interestsApi.getMyInterests,
  });

  useEffect(() => {
    if (currentInterests.length > 0) {
      setSelectedSubDomainIds(currentInterests.map((i) => i.sub_domain_id));
    }
  }, [currentInterests]);

  // Update Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileFormData) => authApi.updateProfile(data),
    onSuccess: async () => {
      await refreshProfile();
      success('Profile Updated', 'Your profile details have been saved.');
    },
    onError: (err: any) => {
      toastError('Update Failed', err.message);
    },
  });

  // Update Interests Mutation
  const saveInterestsMutation = useMutation({
    mutationFn: (ids: string[]) => interestsApi.setMyInterests(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-interests'] });
      success('Interests Updated', 'Your preferred learning topics have been updated.');
    },
    onError: (err: any) => {
      toastError('Failed to save interests', err.message);
    },
  });

  const toggleSubDomain = (id: string) => {
    setSelectedSubDomainIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Profile & Preferences"
        description="Manage your personal information, role credentials, and competency interests."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Account Summary */}
        <div className="bg-white p-6 rounded-2xl border border-border shadow-card flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-primary-light text-primary flex items-center justify-center font-extrabold text-2xl uppercase border-2 border-primary/20">
            {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
          </div>

          <div>
            <h3 className="text-lg font-bold text-charcoal">{profile?.full_name || 'Learner'}</h3>
            <p className="text-xs text-charcoal-muted mt-0.5">{profile?.email}</p>
          </div>

          <div className="pt-2">
            <StatusBadge status={profile?.role} />
          </div>

          <div className="w-full pt-4 border-t border-border text-xs text-charcoal-muted text-left space-y-2">
            <div className="flex justify-between">
              <span>Account Status:</span>
              <span className="font-semibold text-emerald-600">Active</span>
            </div>
            <div className="flex justify-between">
              <span>Member Since:</span>
              <span className="font-semibold text-charcoal">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Profile Form */}
        <div className="md:col-span-2 bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-6">
          <h3 className="text-base font-bold text-charcoal">Personal Information</h3>

          <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="Alex Johnson"
              helperText="This authoritative name will appear on all your verified completion certificates."
              {...register('full_name')}
            />

            <Input
              label="Email Address"
              value={profile?.email || ''}
              disabled
              helperText="Email is managed via Supabase Authentication and cannot be edited directly."
            />

            <Input
              label="Avatar URL (Optional)"
              placeholder="https://example.com/avatar.jpg"
              {...register('avatar_url')}
            />

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                size="md"
                isLoading={updateProfileMutation.isPending}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Profile
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Learning Interests Section */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-charcoal flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Competency & Topic Interests</span>
            </h3>
            <p className="text-xs text-charcoal-muted mt-0.5">
              Select your focus areas to customize course suggestions and skill recommendations.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => saveInterestsMutation.mutate(selectedSubDomainIds)}
            isLoading={saveInterestsMutation.isPending}
          >
            Save Interests
          </Button>
        </div>

        <div className="space-y-6 pt-2">
          {domains.map((domain) => (
            <div key={domain.id} className="border-b border-border/60 pb-4 last:border-b-0 last:pb-0">
              <h4 className="text-xs font-bold text-charcoal mb-2 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                <span>{domain.name}</span>
              </h4>

              <div className="flex flex-wrap gap-2">
                {domain.sub_domains?.map((sd) => {
                  const isSelected = selectedSubDomainIds.includes(sd.id);
                  return (
                    <button
                      key={sd.id}
                      type="button"
                      onClick={() => toggleSubDomain(sd.id)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-primary text-white shadow-sm ring-1 ring-primary'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <span>{sd.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
