import type { FocusMode } from '@focusforge/shared';
import { cn } from '../../utils/cn';

export interface ModeSwitcherProps {
  currentMode: FocusMode;
  onSelectMode: (mode: FocusMode) => void;
  disabled?: boolean;
}

export function ModeSwitcher({ currentMode, onSelectMode, disabled = false }: ModeSwitcherProps) {
  const modes: { id: FocusMode; label: string; activeClass: string }[] = [
    { id: 'focus', label: 'Focus', activeClass: 'bg-primary-btn text-white shadow-sm' },
    { id: 'short-break', label: 'Short Break', activeClass: 'bg-success text-white shadow-sm' },
    { id: 'long-break', label: 'Long Break', activeClass: 'bg-secondary text-white shadow-sm' },
  ];

  return (
    <div
      role="tablist"
      aria-label="Timer Mode"
      className="inline-flex p-1 bg-surface-2 border border-border rounded-button gap-1 select-none"
    >
      {modes.map((m) => {
        const isActive = currentMode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onSelectMode(m.id)}
            className={cn(
              'px-4 py-2 rounded-button text-xs font-semibold transition-all',
              isActive
                ? m.activeClass
                : 'text-text-muted hover:text-text hover:bg-surface/60',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
