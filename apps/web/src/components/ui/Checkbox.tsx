import { forwardRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, checked, ...props }, ref) => {
    const inputId = id || `checkbox-${Math.random().toString(36).substr(2, 6)}`;

    return (
      <label htmlFor={inputId} className="inline-flex items-center gap-2.5 cursor-pointer group select-none">
        <div className="relative flex items-center justify-center">
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
              'w-5 h-5 rounded-[6px] border border-border bg-surface-2 transition-all flex items-center justify-center',
              'peer-checked:bg-primary peer-checked:border-primary text-transparent peer-checked:text-white',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg',
              'group-hover:border-text-subtle peer-disabled:opacity-50',
              className
            )}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        </div>
        {label && <span className="text-sm text-text font-normal">{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
