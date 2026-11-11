import { Link } from 'react-router-dom';
import { Info, X } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useUIStore } from '../../stores/useUIStore';

import { useAuthStore } from '../../stores/useAuthStore';

export function DemoBanner() {
  const { data: settings } = useSettings();
  const { demoBannerDismissed, dismissDemoBanner } = useUIStore();
  const { status } = useAuthStore();

  if (status === 'authenticated' || !settings?.demoDataLoaded || demoBannerDismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Demo Data Notice"
      className="bg-primary-soft border-b border-primary/20 text-text px-4 py-2.5 text-xs flex items-center justify-between gap-3 sticky top-0 z-30 backdrop-blur-md"
    >
      <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1">
        <Info className="w-4 h-4 text-primary shrink-0" />
        <span>
          <strong className="font-semibold text-primary">Demonstration Data Loaded:</strong> You
          are viewing sample study tasks, habits, and sessions.{' '}
          <Link
            to="/settings"
            className="text-primary hover:text-primary-hover font-semibold underline underline-offset-2 ml-1"
          >
            Clear or customize in Settings &rarr;
          </Link>
        </span>
      </div>
      <button
        type="button"
        onClick={dismissDemoBanner}
        aria-label="Dismiss demo data banner"
        className="p-1 rounded-button hover:bg-surface-2 text-text-muted hover:text-text transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
