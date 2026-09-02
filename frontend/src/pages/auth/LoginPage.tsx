import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, Mail, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Button } from '../../components/ui/Button';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { signIn, resendConfirmation, role } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setUnconfirmedEmail(null);
    const result = await signIn(data.email, data.password);
    setIsSubmitting(false);

    if (result.error) {
      if (result.error.toLowerCase().includes('email not confirmed')) {
        setUnconfirmedEmail(data.email);
        toastError('Email Not Confirmed', 'Please verify your email before logging in.');
      } else {
        toastError('Sign In Failed', result.error);
      }
    } else {
      success('Welcome back!', 'Successfully signed in to DataCaliper.');
      const from = (location.state as any)?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else if (role === 'INSTRUCTOR') {
        navigate('/instructor', { replace: true });
      } else {
        navigate('/learner', { replace: true });
      }
    }
  };

  const handleResend = async () => {
    const email = unconfirmedEmail || getValues('email');
    if (!email) return;
    setIsResending(true);
    const res = await resendConfirmation(email);
    setIsResending(false);

    if (res.error) {
      toastError('Resend Failed', res.error);
    } else {
      success('Confirmation Resent', `A new verification email was sent to ${email}.`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link to="/" className="inline-flex items-center gap-2 text-primary font-extrabold text-2xl tracking-tight">
          <div className="p-2 bg-primary text-white rounded-xl shadow-md">
            <GraduationCap className="w-6 h-6" />
          </div>
          <span>DataCaliper</span>
        </Link>
        <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-charcoal tracking-tight">
          Welcome back
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-charcoal-muted">
          Sign in to your account to continue learning and building skills
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-card border border-border space-y-4">
          {/* Unconfirmed Email Notice */}
          {unconfirmedEmail && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">Email confirmation required</p>
                  <p className="mt-0.5 text-amber-800">
                    Your email address (<strong>{unconfirmedEmail}</strong>) has not been confirmed yet. Please check your inbox and click the verification link.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isResending}
                onClick={handleResend}
                className="font-bold text-primary hover:underline flex items-center gap-1 mt-1 text-xs"
              >
                <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                {isResending ? 'Sending...' : 'Resend verification email'}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <PasswordInput
              label="Password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-charcoal-muted">Protected by Supabase Auth</span>
              <Link
                to="/forgot-password"
                className="font-medium text-primary hover:text-primary-hover hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
            >
              Sign In
            </Button>

            <div className="pt-4 border-t border-border text-center text-xs text-charcoal-muted">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary hover:text-primary-hover font-bold hover:underline">
                Create free account
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
