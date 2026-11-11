import { Outlet, NavLink } from 'react-router-dom';
import { FlameKindling, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { ToastContainer } from '../ui/Toast';

export function AuthLayout() {
  const { theme, resolvedTheme, setTheme } = useThemeStore();

  const toggleTheme = () => {
    const nextTheme =
      theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark') ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Soft Purple Ambient Background Glow */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-primary/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Bar Quick Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          className="p-2 text-text-muted hover:text-text rounded-button hover:bg-surface transition-colors"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="w-5 h-5 text-warning" />
          ) : (
            <Moon className="w-5 h-5 text-primary" />
          )}
        </button>
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <NavLink
            to="/"
            className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-button p-1"
          >
            <div className="w-11 h-11 rounded-button bg-primary-btn flex items-center justify-center text-white shadow-soft">
              <FlameKindling className="w-6 h-6 stroke-[2.3]" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-extrabold text-xl tracking-tight text-text leading-tight">
                FocusForge
              </span>
              <span className="text-[10px] text-primary font-bold tracking-wider uppercase">
                Study & Productivity
              </span>
            </div>
          </NavLink>
        </div>

        {/* Auth Card with Soft Glow */}
        <div className="bg-surface/90 backdrop-blur-xl border border-border shadow-modal rounded-card p-6 sm:p-8 transition-all">
          <Outlet />
        </div>

        {/* Guest exploration link */}
        <div className="text-center">
          <NavLink
            to="/"
            className="text-xs font-semibold text-text-muted hover:text-primary transition-colors underline underline-offset-4"
          >
            Continue as Guest (Offline Mode)
          </NavLink>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}
