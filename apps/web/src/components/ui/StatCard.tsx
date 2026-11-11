import React from 'react';
import { Card } from './Card';
import { cn } from '../../utils/cn';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  iconBgColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  subtitle,
  trend,
  iconBgColor = 'bg-primary-soft text-primary',
  className,
}: StatCardProps) {
  return (
    <Card className={cn('p-5 flex flex-col justify-between', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {label}
        </span>
        <div className={cn('w-10 h-10 rounded-button flex items-center justify-center shrink-0', iconBgColor)}>
          {icon}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl md:text-3xl font-bold tracking-tight text-text tabular-nums">
          {value}
        </div>

        {(subtitle || trend) && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            {trend && (
              <span
                className={cn(
                  'font-medium px-1.5 py-0.5 rounded-full text-[11px]',
                  trend.isPositive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                )}
              >
                {trend.value}
              </span>
            )}
            {subtitle && <span className="text-text-muted">{subtitle}</span>}
          </div>
        )}
      </div>
    </Card>
  );
}
