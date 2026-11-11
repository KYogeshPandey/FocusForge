import React from 'react';
import { cn } from '../../utils/cn';

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: TabOption<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  variant?: 'pill' | 'underline';
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className,
  variant = 'pill',
}: TabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div className={cn('flex items-center gap-6 border-b border-border overflow-x-auto', className)}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex items-center gap-2 pb-3 text-sm font-medium transition-colors relative whitespace-nowrap',
                isActive ? 'text-primary' : 'text-text-muted hover:text-text'
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'text-[11px] px-1.5 py-0.2 rounded-full font-semibold',
                    isActive ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-text-subtle'
                  )}
                >
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex p-1 bg-surface-2 border border-border rounded-button gap-1 overflow-x-auto',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-button text-xs font-semibold transition-all whitespace-nowrap',
              isActive
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-muted hover:text-text hover:bg-surface/50'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                  isActive ? 'bg-primary-soft text-primary' : 'bg-surface text-text-subtle'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
