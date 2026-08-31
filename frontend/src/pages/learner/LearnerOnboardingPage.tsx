import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Check, ArrowRight, BookOpen } from 'lucide-react';
import { domainsApi } from '../../api/domains';
import { interestsApi } from '../../api/interests';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';

export const LearnerOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const [selectedSubDomainIds, setSelectedSubDomainIds] = useState<string[]>([]);

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ['onboarding-domains'],
    queryFn: domainsApi.list,
  });

  const { data: currentInterests = [] } = useQuery({
    queryKey: ['my-interests'],
    queryFn: interestsApi.getMyInterests,
  });

  useEffect(() => {
    if (currentInterests.length > 0) {
      setSelectedSubDomainIds(currentInterests.map((i) => i.sub_domain_id));
    }
  }, [currentInterests]);

  const saveInterestsMutation = useMutation({
    mutationFn: (ids: string[]) => interestsApi.setMyInterests(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-interests'] });
      queryClient.invalidateQueries({ queryKey: ['personalized-courses'] });
      success('Preferences Saved', 'Your learning dashboard has been personalized.');
      navigate('/learner');
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

  const handleContinue = () => {
    saveInterestsMutation.mutate(selectedSubDomainIds);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Loading subject domains..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-light text-primary text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Personalize Your Experience</span>
          </div>
          <h1 className="text-3xl font-extrabold text-charcoal tracking-tight">
            Welcome to DataCaliper
          </h1>
          <p className="mt-2 text-sm text-charcoal-muted max-w-lg mx-auto">
            Choose the domains and technical topics you are interested in. We will tailor your recommendations and course discovery.
          </p>
        </div>

        {/* Domain & Sub-domain Selection Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-6">
          <div className="space-y-6">
            {domains.map((domain) => (
              <div key={domain.id} className="border-b border-border/60 pb-5 last:border-b-0 last:pb-0">
                <h3 className="text-sm font-bold text-charcoal mb-1 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>{domain.name}</span>
                </h3>
                {domain.description && (
                  <p className="text-xs text-charcoal-muted mb-3">{domain.description}</p>
                )}

                {/* Sub-domain pill buttons */}
                <div className="flex flex-wrap gap-2">
                  {domain.sub_domains && domain.sub_domains.length > 0 ? (
                    domain.sub_domains.map((sd) => {
                      const isSelected = selectedSubDomainIds.includes(sd.id);
                      return (
                        <button
                          key={sd.id}
                          type="button"
                          onClick={() => toggleSubDomain(sd.id)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-primary text-white shadow-sm ring-1 ring-primary'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          <span>{sd.name}</span>
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-400 italic">No sub-domains listed yet</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/learner')}
              className="text-xs text-charcoal-muted hover:text-charcoal underline"
            >
              Skip for now
            </button>

            <Button
              onClick={handleContinue}
              isLoading={saveInterestsMutation.isPending}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Dashboard ({selectedSubDomainIds.length} selected)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
