import { lazy, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { FlameKindling } from 'lucide-react';
import { queryClient } from './queryClient';
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/auth/AuthLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useAuthStore } from './stores/useAuthStore';

// Lazy loaded page components for route-level code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const FocusTimerPage = lazy(() => import('./pages/FocusTimerPage'));
const HabitsPage = lazy(() => import('./pages/HabitsPage'));
const StudyPlannerPage = lazy(() => import('./pages/StudyPlannerPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function AppFallback() {
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
      <span className="sr-only">Loading application</span>
    </div>
  );
}

export function App() {
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    // Restore session on application startup
    initializeAuth();
  }, [initializeAuth]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true }}>
          <Suspense fallback={<AppFallback />}>
            <Routes>
              {/* Public Authentication Pages */}
              <Route element={<AuthLayout />}>
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
              </Route>

              {/* Core Application Pages protected by Auth Guard */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="dashboard" element={<Navigate to="/" replace />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="timer" element={<FocusTimerPage />} />
                  <Route path="habits" element={<HabitsPage />} />
                  <Route path="planner" element={<StudyPlannerPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="404" element={<NotFoundPage />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
