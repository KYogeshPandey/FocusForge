import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, label, description, id, checked, ...props }, ref) => {
    const inputId = id || `toggle-${Math.random().toString(36).substr(2, 6)}`;

    return (
      <div className="flex items-center justify-between gap-4 py-1">
        {(label || description) && (
          <label htmlFor={inputId} className="cursor-pointer select-none">
            {label && <div className="text-sm font-medium text-text">{label}</div>}
            {description && <div className="text-xs text-text-muted">{description}</div>}
          </label>
        )}
        <div className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            id={inputId}
            type="checkbox"
            ref={ref}
            checked={checked}
            className="sr-only peer"
            {...props}
          />
          <div
            className={cn(
              'w-11 h-6 bg-surface-2 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-border',
              className
            )}
          />
        </div>
      </div>
    );
  }
);

Toggle.displayName = 'Toggle';
