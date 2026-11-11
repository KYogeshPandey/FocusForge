import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  Timer,
  Flame,
  BarChart3,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  FlameKindling,
  X,
} from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSettings } from '../../hooks/useSettings';
import { cn } from '../../utils/cn';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/planner', label: 'Study Planner', icon: CalendarDays },
  { to: '/timer', label: 'Focus Timer', icon: Timer },
  { to: '/habits', label: 'Habit Tracker', icon: Flame },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, mobileDrawerOpen, setMobileDrawerOpen } = useUIStore();
  const { user, status } = useAuthStore();
  const { data: settings } = useSettings();

  const isAuthenticated = status === 'authenticated' && user !== null;
  const userName = isAuthenticated ? user.name : settings?.userName || 'Guest User';
  const userSubtext = isAuthenticated ? user.email : 'Local Guest Mode';

  const navContent = (
    <div className="flex flex-col h-full bg-surface border-r border-border select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
        <NavLink
          to="/"
          className="flex items-center gap-3 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-button p-1"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div className="w-9 h-9 rounded-button bg-primary-btn flex items-center justify-center text-white shrink-0 shadow-sm">
            <FlameKindling className="w-5 h-5 stroke-[2.2]" />
          </div>
          {(!sidebarCollapsed || mobileDrawerOpen) && (
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-text leading-tight">
                FocusForge
              </span>
              <span className="text-[10px] text-primary font-medium tracking-wider uppercase">
                Study & Productivity
              </span>
            </div>
          )}
        </NavLink>

        {/* Mobile close button */}
        {mobileDrawerOpen ? (
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            aria-label="Close navigation menu"
            className="md:hidden p-1.5 text-text-muted hover:text-text rounded-button hover:bg-surface-2"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          /* Desktop collapse button */
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex p-1.5 text-text-muted hover:text-text rounded-button hover:bg-surface-2 transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto" aria-label="Main Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileDrawerOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-all relative group',
                  isActive
                    ? 'bg-primary-soft text-primary font-semibold'
                    : 'text-text-muted hover:text-text hover:bg-surface-2',
                  sidebarCollapsed && !mobileDrawerOpen && 'justify-center px-0'
                )
              }
              title={sidebarCollapsed && !mobileDrawerOpen ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r-full" />
                  )}
                  <Icon
                    className={cn(
                      'w-5 h-5 shrink-0 transition-colors',
                      isActive ? 'text-primary' : 'text-text-muted group-hover:text-text'
                    )}
                  />
                  {(!sidebarCollapsed || mobileDrawerOpen) && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Pinned Bottom: Settings & User Profile */}
      <div className="p-3 border-t border-border shrink-0 space-y-2">
        <NavLink
          to="/settings"
          onClick={() => setMobileDrawerOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-all relative group',
              isActive
                ? 'bg-primary-soft text-primary font-semibold'
                : 'text-text-muted hover:text-text hover:bg-surface-2',
              sidebarCollapsed && !mobileDrawerOpen && 'justify-center px-0'
            )
          }
          title={sidebarCollapsed && !mobileDrawerOpen ? 'Settings' : undefined}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r-full" />
              )}
              <SettingsIcon
                className={cn(
                  'w-5 h-5 shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-text-muted group-hover:text-text'
                )}
              />
              {(!sidebarCollapsed || mobileDrawerOpen) && <span>Settings</span>}
            </>
          )}
        </NavLink>

        {/* User Badge */}
        {(!sidebarCollapsed || mobileDrawerOpen) && (
          <div className="flex items-center gap-3 px-3 py-2 bg-surface-2/60 rounded-button">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-text truncate">{userName}</div>
              <div className="text-[10px] text-text-subtle truncate">{userSubtext}</div>
            </div>
            {!isAuthenticated && (
              <NavLink
                to="/login"
                className="text-[10px] font-bold text-primary hover:underline shrink-0"
              >
                Sign In
              </NavLink>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop / Tablet Persistent Sidebar */}
      <aside
        className={cn(
          'hidden md:block fixed top-0 bottom-0 left-0 z-20 transition-all duration-normal',
          sidebarCollapsed ? 'w-[72px]' : 'w-60'
        )}
      >
        {navContent}
      </aside>

      {/* Mobile Drawer Backdrop & Drawer */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[80vw] h-full shadow-modal animate-in slide-in-from-left duration-normal">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
