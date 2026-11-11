import { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { DemoBanner } from './DemoBanner';
import { OfflineBanner } from './OfflineBanner';
import { DataMigrationModal } from '../auth/DataMigrationModal';
import { SkipToContent } from './SkipToContent';
import { ToastContainer } from '../ui/Toast';
import { Skeleton } from '../ui/Skeleton';
import { useUIStore } from '../../stores/useUIStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useTimerStore } from '../../stores/useTimerStore';
import { cn } from '../../utils/cn';

function PageLoader() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-72 rounded-card lg:col-span-2" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  );
}

export function AppLayout() {
  const { sidebarCollapsed } = useUIStore();
  const { initializeTheme } = useThemeStore();
  const { syncTick, initialize: initializeTimer } = useTimerStore();

  useEffect(() => {
    initializeTheme();
    initializeTimer();

    // Timer tick interval
    const interval = setInterval(() => {
      syncTick();
    }, 1000);

    return () => clearInterval(interval);
  }, [initializeTheme, initializeTimer, syncTick]);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <SkipToContent />

      {/* Persistent Sidebar */}
      <Sidebar />

      {/* Main Column */}
      <div
        className={cn(
          'flex flex-col flex-1 transition-all duration-normal pb-20 md:pb-8',
          sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-60'
        )}
      >
        <OfflineBanner />
        <DemoBanner />
        <Topbar />

        <main id="main-content" className="flex-1 focus:outline-none" tabIndex={-1}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />

      {/* Data Migration Wizard Modal */}
      <DataMigrationModal />

      {/* Global Toasts */}
      <ToastContainer />
    </div>
  );
}
