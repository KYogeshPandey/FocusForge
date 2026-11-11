import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="bg-warning/20 border-b border-warning/30 text-warning px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 select-none"
    >
      <WifiOff className="w-4 h-4 shrink-0 stroke-[2.2]" />
      <span>
        You are currently offline. Changes are saved locally and will sync once connection is
        restored.
      </span>
    </aside>
  );
}
