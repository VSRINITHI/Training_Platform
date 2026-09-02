import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, Lock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Loader2, KeyRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

const setPasswordSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SetPasswordFormData = z.infer<typeof setPasswordSchema>;

export const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshProfile, signOut } = useAuth();
  const { success, error: toastError } = useToast();

  const [sessionChecking, setSessionChecking] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [assignedRole, setAssignedRole] = useState<string>('USER');
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const establishAndCheckSession = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const hashClean = location.hash.startsWith('#') ? location.hash.substring(1) : location.hash;
        const hashParams = new URLSearchParams(hashClean);

        const mode = params.get('mode');
        const type = params.get('type') || hashParams.get('type');
        const isRecovery = mode === 'recovery' || type === 'recovery';
        if (isRecovery) {
          setIsRecoveryFlow(true);
        }

        // 1. Check for PKCE authorization code in URL
        const code = params.get('code');
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError && data.session?.user && isMounted) {
            setCurrentUserEmail(data.session.user.email || null);
            const role =
              (data.session.user.app_metadata?.role as string) ||
              (data.session.user.user_metadata?.role as string) ||
              'USER';
            setAssignedRole(role);
            setHasActiveSession(true);
            setSessionChecking(false);
            return;
          }
        }

        // 2. Check existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          setCurrentUserEmail(session.user.email || null);
          const role =
            (session.user.app_metadata?.role as string) ||
            (session.user.user_metadata?.role as string) ||
            'USER';
          setAssignedRole(role);
          setHasActiveSession(true);
          setSessionChecking(false);
          return;
        }

        // 3. Listen for auth state change if hash fragment / token exchange is resolving
        const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (newSession?.user && isMounted) {
            authListener.subscription.unsubscribe();
            if (event === 'PASSWORD_RECOVERY') {
              setIsRecoveryFlow(true);
            }
            setCurrentUserEmail(newSession.user.email || null);
            const role =
              (newSession.user.app_metadata?.role as string) ||
              (newSession.user.user_metadata?.role as string) ||
              'USER';
            setAssignedRole(role);
            setHasActiveSession(true);
            setSessionChecking(false);
          }
        });

        // 4. Fallback timeout
        setTimeout(() => {
          if (isMounted && sessionChecking) {
            setSessionChecking(false);
          }
        }, 4000);
      } catch (err) {
        console.error('Session detection error:', err);
        if (isMounted) {
          setSessionChecking(false);
        }
      }
    };

    establishAndCheckSession();

    return () => {
      isMounted = false;
    };
  }, [location, sessionChecking]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema),
  });

  const onSubmit = async (data: SetPasswordFormData) => {
    setIsSubmitting(true);
    try {
      if (isRecoveryFlow) {
        // ========================================================================
        // FLOW 1: PASSWORD RECOVERY (Forgot Password)
        // ========================================================================
        const { error: updateError } = await supabase.auth.updateUser({
          password: data.password,
        });

        if (updateError) {
          setIsSubmitting(false);
          toastError('Password Reset Failed', updateError.message);
          return;
        }

        // Sign out of the temporary recovery session so the user logs in cleanly
        await signOut();
        setIsSubmitting(false);

        success(
          'Password Updated Successfully',
          'Your password has been reset. Please sign in with your new password.'
        );

        // Redirect to /login
        navigate('/login', { replace: true });
      } else {
        // ========================================================================
        // FLOW 2: ADMIN INVITATION (Account Activation)
        // ========================================================================
        const { error: updateError } = await supabase.auth.updateUser({
          password: data.password,
          data: {
            needs_password: false,
            is_invited: false,
          },
        });

        if (updateError) {
          setIsSubmitting(false);
          toastError('Password Setup Failed', updateError.message);
          return;
        }

        // Synchronize profile with backend to transition invitation to ACCEPTED
        let profile;
        try {
          profile = await authApi.syncProfile();
        } catch {
          profile = await authApi.getMe();
        }

        await refreshProfile();
        setIsSubmitting(false);

        success('Account Activated 🎉', 'Your password has been saved. Welcome to DataCaliper!');

        // Role-based portal redirect for invited members
        const role = profile?.role || assignedRole;
        if (role === 'INSTRUCTOR') {
          navigate('/instructor', { replace: true });
        } else if (role === 'ADMIN') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/learner', { replace: true });
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      toastError('Error', err.message || 'Failed to update password.');
    }
  };

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center py-12 px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-card border border-border text-center space-y-4 max-w-md w-full">
          <div className="w-14 h-14 bg-indigo-50 text-primary rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <h2 className="text-lg font-bold text-charcoal">
            {isRecoveryFlow ? 'Verifying Password Reset Link...' : 'Verifying Invitation Session...'}
          </h2>
          <p className="text-xs text-charcoal-muted">Setting up your secure workspace...</p>
        </div>
      </div>
    );
  }

  if (!hasActiveSession) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-primary font-extrabold text-2xl tracking-tight">
            <div className="p-2 bg-primary text-white rounded-xl shadow-md">
              <GraduationCap className="w-6 h-6" />
            </div>
            <span>DataCaliper</span>
          </Link>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-card border border-border text-center space-y-5">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-charcoal">
              {isRecoveryFlow ? 'Reset Link Expired or Invalid' : 'Session Not Found or Expired'}
            </h2>
            <p className="text-xs sm:text-sm text-charcoal-muted leading-relaxed">
              {isRecoveryFlow
                ? 'Your password reset link is invalid or has expired. Please request a fresh password reset link.'
                : 'No active invitation session was detected. Please click the Accept Invitation link from your invitation email, or contact your administrator.'}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              {isRecoveryFlow && (
                <Link to="/forgot-password" className="flex-1">
                  <Button size="md" variant="outline" className="w-full">
                    Request New Link
                  </Button>
                </Link>
              )}
              <Link to="/login" className="flex-1">
                <Button size="md" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Go to Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link to="/" className="inline-flex items-center gap-2 text-primary font-extrabold text-2xl tracking-tight">
          <div className="p-2 bg-primary text-white rounded-xl shadow-md">
            <GraduationCap className="w-6 h-6" />
          </div>
          <span>DataCaliper</span>
        </Link>
        <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-charcoal tracking-tight">
          {isRecoveryFlow ? 'Reset Your Password' : 'Set Your Password'}
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-charcoal-muted">
          {isRecoveryFlow
            ? 'Choose a new password to restore access to your DataCaliper account'
            : 'Create a secure password to complete your account activation'}
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-card border border-border space-y-6">
          {/* Account Context Banner */}
          <div className="bg-slate-50 p-4 rounded-xl border border-border flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-semibold text-charcoal-muted uppercase tracking-wider">
                {isRecoveryFlow ? 'Account Email' : 'Invited Account'}
              </p>
              <p className="text-sm font-bold text-charcoal truncate">
                {currentUserEmail || 'Authenticated User'}
              </p>
            </div>
            {isRecoveryFlow ? (
              <Badge variant="warning" size="sm">
                Password Reset
              </Badge>
            ) : (
              <Badge variant={assignedRole === 'INSTRUCTOR' ? 'primary' : 'outline'} size="sm">
                {assignedRole === 'INSTRUCTOR' ? 'Instructor' : 'Learner'}
              </Badge>
            )}
          </div>

          <div className="text-xs text-charcoal-muted flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {isRecoveryFlow
                ? 'After updating your password, you will be redirected to the sign in page.'
                : 'Set your password now. You will use this to sign in in the future.'}
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <PasswordInput
              label="New Password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <PasswordInput
              label="Confirm New Password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <p className="text-[11px] text-charcoal-muted">
              Must be at least 6 characters long.
            </p>

            <Button
              type="submit"
              size="lg"
              className="w-full mt-2"
              isLoading={isSubmitting}
              leftIcon={isRecoveryFlow ? <KeyRound className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            >
              {isRecoveryFlow ? 'Update Password & Sign In' : 'Activate Account & Continue'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
