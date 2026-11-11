import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, AlertCircle } from 'lucide-react';
import { RegisterInputSchema, type RegisterInput } from '@focusforge/shared';
import { useAuthStore } from '../stores/useAuthStore';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiError } from '../services/api/apiError';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register: registerUser } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterInputSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setFormError(null);
    try {
      await registerUser(data);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('Registration failed. Please check your details and try again.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-text">Create Account</h1>
        <p className="text-xs text-text-muted">Start tracking your study habits and focus today</p>
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
          id="register-name"
          label="Your Full Name"
          type="text"
          autoComplete="name"
          placeholder="e.g. Alex Rivera"
          error={errors.name?.message}
          required
          {...register('name')}
        />

        <Input
          id="register-email"
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="student@example.com"
          error={errors.email?.message}
          required
          {...register('email')}
        />

        <div className="relative">
          <Input
            id="register-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            hint="Must be at least 8 characters long"
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

        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className="w-full gap-2 mt-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>Sign Up</span>
        </Button>
      </form>

      <div className="text-center pt-2 border-t border-border/60">
        <p className="text-xs text-text-muted">
          Already have an account?{' '}
          <Link
            to="/login"
            state={{ from: location.state?.from }}
            className="font-bold text-primary hover:text-primary-hover transition-colors underline underline-offset-2"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
