import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, Mail, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Button } from '../../components/ui/Button';

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { signUp, resendConfirmation } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true);
    const result = await signUp(data.email, data.password, data.fullName);
    setIsSubmitting(false);

    if (result.error) {
      toastError('Registration Failed', result.error);
      return;
    }

    if (result.session) {
      // Immediate session (e.g. if email confirmation is disabled)
      success('Account Created', 'Welcome to DataCaliper! Let us personalize your experience.');
      navigate('/learner/onboarding');
    } else {
      // Email confirmation required
      setRegisteredEmail(data.email);
      success('Verification Sent', 'Please check your email to confirm your account.');
    }
  };

  const handleResend = async () => {
    if (!registeredEmail) return;
    setIsResending(true);
    const res = await resendConfirmation(registeredEmail);
    setIsResending(false);

    if (res.error) {
      toastError('Resend Failed', res.error);
    } else {
      success('Email Sent', `A new verification email was sent to ${registeredEmail}.`);
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
          {registeredEmail ? 'Check your email' : 'Create your account'}
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-charcoal-muted">
          {registeredEmail
            ? 'Confirm your email address to activate your DataCaliper account'
            : 'Start your personalized learning journey with DataCaliper'}
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-card border border-border">
          {registeredEmail ? (
            /* Email Confirmation Screen */
            <div className="text-center space-y-5">
              <div className="w-16 h-16 bg-indigo-50 text-primary rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-charcoal">Check your email to confirm your account</h3>
                <p className="text-xs sm:text-sm text-charcoal-muted leading-relaxed">
                  We have sent a verification link to{' '}
                  <strong className="text-charcoal font-semibold">{registeredEmail}</strong>.
                  Please click the link to confirm your email and sign in.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-border text-xs text-charcoal-muted text-left space-y-1">
                <p className="font-semibold text-charcoal flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  What to do next:
                </p>
                <p>1. Open your email client inbox.</p>
                <p>2. Open the email from DataCaliper / Supabase.</p>
                <p>3. Click <strong>Confirm your mail</strong> to finish activating your account.</p>
              </div>

              <div className="pt-2 space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  isLoading={isResending}
                  onClick={handleResend}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Resend confirmation email
                </Button>

                <Link to="/login" className="block">
                  <Button size="md" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Proceed to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Alex Johnson"
                error={errors.fullName?.message}
                {...register('fullName')}
              />

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

              <PasswordInput
                label="Confirm Password"
                placeholder="••••••••"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />

              <div className="text-xs text-charcoal-muted leading-relaxed">
                By creating an account, you agree to our{' '}
                <a href="#terms" className="text-primary hover:underline font-medium">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#privacy" className="text-primary hover:underline font-medium">
                  Privacy Policy
                </a>
                .
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
              >
                Create Account
              </Button>

              <div className="pt-4 border-t border-border text-center text-xs text-charcoal-muted">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:text-primary-hover font-bold hover:underline">
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
