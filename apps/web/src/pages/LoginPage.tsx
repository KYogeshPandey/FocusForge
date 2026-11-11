import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { LoginInputSchema, type LoginInput } from '@focusforge/shared';
import { useAuthStore } from '../stores/useAuthStore';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';
import { ApiError } from '../services/api/apiError';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Return to intended page or dashboard
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setFormError(null);
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('Failed to sign in. Please verify your credentials.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-text">Welcome Back</h1>
        <p className="text-xs text-text-muted">Sign in to sync your study plan across devices</p>
      </div>

      {formError && (
        <div
          role="alert"
          className="p-3 bg-danger/10 border border-danger/30 rounded-button flex items-start gap-2.5 text-xs text-danger font-medium animate-in fade-in duration-fast"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          id="login-email"
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="student@example.com"
          error={errors.email?.message}
          required
          {...register('email')}
        />

        <div className="space-y-1.5">
          <div className="relative">
            <Input
              id="login-password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              required
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-8 text-text-muted hover:text-text p-1 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className="w-full gap-2 mt-2"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In</span>
        </Button>
      </form>

      <div className="text-center pt-2 border-t border-border/60">
        <p className="text-xs text-text-muted">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            state={{ from: location.state?.from }}
            className="font-bold text-primary hover:text-primary-hover transition-colors underline underline-offset-2"
          >
            Create an account
          </Link>
        </p>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </div>
  );
}
