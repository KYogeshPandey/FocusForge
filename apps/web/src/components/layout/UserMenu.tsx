import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Settings as SettingsIcon, LogIn, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

export function UserMenu() {
  const navigate = useNavigate();
  const { user, status, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = status === 'authenticated' && user !== null;
  const displayName = isAuthenticated ? user.name : 'Guest User';
  const displayEmail = isAuthenticated ? user.email : 'Local offline storage';

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login');
  };

  if (!isAuthenticated) {
    return (
      <NavLink
        to="/login"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:text-primary-hover bg-primary-soft hover:bg-primary/20 rounded-button transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>Sign In</span>
      </NavLink>
    );
  }

  const initial = displayName.charAt(0).toUpperCase() || 'U';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User account menu"
        className="flex items-center gap-2 p-1 pl-2 text-text hover:bg-surface-2 rounded-button transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
          {initial}
        </div>
        <span className="hidden md:inline text-xs font-semibold max-w-[120px] truncate text-text">
          {displayName}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-card shadow-modal p-2 z-50 animate-in fade-in zoom-in-95 duration-fast"
        >
          {/* User Profile Header */}
          <div className="px-3 py-2 border-b border-border/80 mb-1">
            <p className="text-xs font-bold text-text truncate">{displayName}</p>
            <p className="text-[11px] text-text-muted truncate">{displayEmail}</p>
          </div>

          <NavLink
            to="/settings"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-muted hover:text-text hover:bg-surface-2 rounded-button transition-colors"
          >
            <SettingsIcon className="w-4 h-4 text-text-muted" />
            <span>Settings & Account</span>
          </NavLink>

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 rounded-button transition-colors text-left"
          >
            <LogOut className="w-4 h-4 text-danger" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
