import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, GraduationCap, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshProfile } = useAuth();

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    const handleAuthCallback = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const hashClean = location.hash.startsWith('#') ? location.hash.substring(1) : location.hash;
        const hashParams = new URLSearchParams(hashClean);

        const code = params.get('code');
        const callbackType = params.get('type') || hashParams.get('type');
        const error = params.get('error') || hashParams.get('error');
        const errorDescription = params.get('error_description') || hashParams.get('error_description');

        if (error) {
          if (!isMounted) return;
          setStatus('error');
          setErrorMessage(errorDescription || error || 'Authentication failed');
          return;
        }

        // 1. Exchange PKCE code if present
        let currentSession = null;
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (!isMounted) return;
            setStatus('error');
            setErrorMessage(exchangeError.message);
            return;
          }
          currentSession = data.session;
        }

        // 2. Retrieve established session if not already returned by exchange
        if (!currentSession) {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            if (!isMounted) return;
            setStatus('error');
            setErrorMessage(sessionError.message);
            return;
          }
          currentSession = session;
        }

        // 3. Fallback listener if session is still being established via hash fragment
        if (!currentSession) {
          const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (newSession && isMounted) {
              authListener.subscription.unsubscribe();
              if (event === 'PASSWORD_RECOVERY' || callbackType === 'recovery') {
                navigate('/set-password?mode=recovery', { replace: true });
              } else if (checkIfMustSetPassword(newSession.user, params, hashParams)) {
                navigate('/set-password?mode=invite', { replace: true });
              } else {
                await syncAndRedirect(newSession);
              }
            }
          });

          setTimeout(() => {
            if (isMounted && status === 'processing') {
              setStatus('error');
              setErrorMessage('Verification link expired or session could not be established. Please try logging in or requesting a new reset link.');
            }
          }, 5000);
          return;
        }

        // 4. Route decision:
        // A. Password Recovery flow -> /set-password?mode=recovery
        if (callbackType === 'recovery') {
          if (!isMounted) return;
          navigate('/set-password?mode=recovery', { replace: true });
          return;
        }

        // B. Admin Invitation flow -> /set-password?mode=invite
        const isInvite = checkIfMustSetPassword(currentSession.user, params, hashParams);
        if (isInvite) {
          if (!isMounted) return;
          navigate('/set-password?mode=invite', { replace: true });
          return;
        }

        // C. Normal registration email confirmation -> redirect to dashboard
        await syncAndRedirect(currentSession);
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage(err.message || 'An unexpected error occurred during confirmation.');
      }
    };

    const checkIfMustSetPassword = (user: any, searchParams: URLSearchParams, hashParams: URLSearchParams): boolean => {
      const callbackType = searchParams.get('type') || hashParams.get('type');
      if (callbackType === 'invite') {
        return true;
      }
      if (!user) return false;
      if (user.app_metadata?.needs_password === true || user.user_metadata?.needs_password === true) {
        return true;
      }
      if (user.app_metadata?.is_invited === true || user.user_metadata?.is_invited === true) {
        return true;
      }
      if (user.invited_at && user.user_metadata?.needs_password !== false && user.app_metadata?.needs_password !== false) {
        return true;
      }
      return false;
    };

    const syncAndRedirect = async (activeSession: any) => {
      try {
        let userProfile;
        try {
          userProfile = await authApi.syncProfile();
        } catch {
          userProfile = await authApi.getMe();
        }

        await refreshProfile();

        if (!isMounted) return;
        setStatus('success');

        setTimeout(() => {
          if (!isMounted) return;
          const userRole = userProfile?.role;
          if (userRole === 'ADMIN') {
            navigate('/admin', { replace: true });
          } else if (userRole === 'INSTRUCTOR') {
            navigate('/instructor', { replace: true });
          } else {
            navigate('/learner', { replace: true });
          }
        }, 1500);
      } catch (syncErr: any) {
        console.warn('Profile sync warning:', syncErr);
        if (!isMounted) return;
        setStatus('success');
        setTimeout(() => {
          navigate('/learner', { replace: true });
        }, 1500);
      }
    };

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [location, navigate, refreshProfile, status]);

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
          {status === 'processing' && (
            <>
              <div className="w-16 h-16 bg-indigo-50 text-primary rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-charcoal">Verifying Your Account</h2>
              <p className="text-xs sm:text-sm text-charcoal-muted">
                Establishing your secure session and preparing your workspace...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-charcoal">Email Confirmed! 🎉</h2>
              <p className="text-xs sm:text-sm text-charcoal-muted">
                Your account is verified. Redirecting you to DataCaliper...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-charcoal">Verification Issue</h2>
              <p className="text-xs sm:text-sm text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                {errorMessage}
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Link to="/forgot-password" className="flex-1">
                  <Button size="md" variant="outline" className="w-full">
                    Forgot Password
                  </Button>
                </Link>
                <Link to="/login" className="flex-1">
                  <Button size="md" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Sign In
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
