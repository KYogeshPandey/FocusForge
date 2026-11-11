import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FlameKindling } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

export function ProtectedRoute() {
  const location = useLocation();
  const { status, hasCheckedSession } = useAuthStore();

  // Full-page loading state during initial session check
  if (status === 'loading' || !hasCheckedSession) {
    return (
      <div
        className="min-h-screen bg-bg text-text flex flex-col items-center justify-center p-4 space-y-4 select-none"
        role="status"
        aria-live="polite"
      >
        <div className="w-12 h-12 rounded-card bg-primary-btn flex items-center justify-center text-white shadow-soft animate-bounce">
          <FlameKindling className="w-7 h-7 stroke-[2.3]" />
        </div>
        <div className="flex flex-col items-center space-y-1">
          <p className="text-sm font-bold text-text">Loading FocusForge...</p>
          <p className="text-xs text-text-muted">Restoring your workspace</p>
        </div>
        <span className="sr-only">Restoring authentication session</span>
      </div>
    );
  }

  // Redirect to login if user explicitly logged out or session failed unauthenticated
  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Allowed for 'authenticated' and 'guest'
  return <Outlet />;
}
