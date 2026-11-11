import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-button';

    const variantStyles = {
      primary: 'bg-primary-btn text-white hover:bg-primary-btn-hover shadow-sm',
      secondary: 'bg-surface-2 text-text border border-border hover:bg-surface hover:border-text-subtle',
      ghost: 'bg-transparent text-text hover:bg-surface-2',
      danger: 'bg-danger-btn text-white hover:bg-danger-btn-hover shadow-sm',
    };

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs gap-1.5 min-h-[32px]',
      md: 'h-10 px-4 text-sm gap-2 min-h-[40px]',
      lg: 'h-12 px-6 text-base gap-2.5 min-h-[48px]',
      icon: 'h-10 w-10 min-w-[40px] min-h-[40px] p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-current" />
            <span className="sr-only">Loading...</span>
          </>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
