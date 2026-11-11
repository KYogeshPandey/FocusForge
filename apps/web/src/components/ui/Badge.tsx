import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'muted';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    primary: 'bg-primary-soft text-primary border-primary/20',
    secondary: 'bg-secondary/15 text-secondary border-secondary/20',
    success: 'bg-success/15 text-success border-success/20',
    warning: 'bg-warning/15 text-warning border-warning/20',
    danger: 'bg-danger/15 text-danger border-danger/20',
    muted: 'bg-surface-2 text-text-muted border-border',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5 font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-transparent font-medium tracking-wide transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: 'low' | 'medium' | 'high' }) {
  const map = {
    high: { label: 'High', variant: 'danger' as const },
    medium: { label: 'Medium', variant: 'warning' as const },
    low: { label: 'Low', variant: 'secondary' as const },
  };

  const item = map[priority] || map.medium;
  return (
    <Badge variant={item.variant} size="sm">
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      {item.label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: 'todo' | 'in-progress' | 'done' }) {
  const map = {
    todo: { label: 'To Do', variant: 'muted' as const },
    'in-progress': { label: 'In Progress', variant: 'secondary' as const },
    done: { label: 'Completed', variant: 'success' as const },
  };

  const item = map[status] || map.todo;
  return (
    <Badge variant={item.variant} size="sm">
      {item.label}
    </Badge>
  );
}
