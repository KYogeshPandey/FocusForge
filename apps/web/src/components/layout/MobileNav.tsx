import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Timer, Flame, CalendarDays } from 'lucide-react';
import { cn } from '../../utils/cn';

const MOBILE_NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/timer', label: 'Timer', icon: Timer },
  { to: '/habits', label: 'Habits', icon: Flame },
  { to: '/planner', label: 'Planner', icon: CalendarDays },
];

export function MobileNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border flex items-center justify-around py-1.5 px-2 select-none"
      aria-label="Mobile Bottom Navigation"
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center py-1 px-3 min-w-[56px] min-h-[44px] rounded-button text-[10px] font-medium transition-colors',
                isActive ? 'text-primary font-semibold' : 'text-text-muted hover:text-text'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'w-5 h-5 mb-0.5 transition-transform',
                    isActive && 'scale-110 text-primary'
                  )}
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
