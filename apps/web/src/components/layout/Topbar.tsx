import { useState } from 'react';
import { Menu, Sun, Moon, Plus } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { format } from 'date-fns';
import { Button } from '../ui/Button';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { UserMenu } from './UserMenu';

export function Topbar() {
  const { setMobileDrawerOpen } = useUIStore();
  const { theme, resolvedTheme, setTheme } = useThemeStore();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const toggleTheme = () => {
    const nextTheme = (theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark'))
      ? 'light'
      : 'dark';
    setTheme(nextTheme);
  };

  const todayStr = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <>
      <header className="h-16 bg-surface/80 backdrop-blur-md border-b border-border sticky top-0 z-20 flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open mobile navigation menu"
            className="md:hidden p-2 text-text-muted hover:text-text rounded-button hover:bg-surface-2 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:block">
            <span className="text-xs font-medium text-text-muted">{todayStr}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-2 text-text-muted hover:text-text rounded-button hover:bg-surface-2 transition-colors"
            title={`Current: ${theme} (${resolvedTheme})`}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-warning" />
            ) : (
              <Moon className="w-4 h-4 text-primary" />
            )}
          </button>

          {/* Quick Add Button */}
          <Button
            size="sm"
            onClick={() => setIsTaskModalOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Task</span>
          </Button>

          {/* User Profile Menu */}
          <UserMenu />
        </div>
      </header>

      {/* Quick Task Modal */}
      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
      />
    </>
  );
}
