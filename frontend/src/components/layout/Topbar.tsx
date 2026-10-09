import React from 'react';
import { Menu, LogOut, UserCircle, Sun, Moon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Avatar } from '../common/Avatar';
import { Dropdown } from '../common/Dropdown';

interface TopbarProps {
  onToggleMobileMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleMobileMenu }) => {
  const { user, tenant, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const getPageTitle = (path: string) => {
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/users')) return 'Users & Access';
    if (path.startsWith('/team')) return 'My Team';
    if (path.startsWith('/departments')) return 'Departments';
    if (path.startsWith('/documents')) return 'Knowledge Documents';
    if (path.startsWith('/chat')) return 'Knowledge Assistant';
    if (path.startsWith('/profile')) return 'Account Settings';
    return 'Enterprise Assistant';
  };

  const userMenuItems = [
    {
      label: 'Account Settings',
      icon: <UserCircle className="w-4 h-4" />,
      onClick: () => navigate('/profile'),
    },
    {
      label: 'Sign Out',
      icon: <LogOut className="w-4 h-4" />,
      onClick: () => {
        logout();
        navigate('/login');
      },
      danger: true,
    },
  ];

  return (
    <header className="h-14 bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#1f1f1f] px-4 sm:px-6 flex items-center justify-between z-10 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#18181b] transition-colors cursor-pointer"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {getPageTitle(location.pathname)}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate">
            {tenant?.name || 'Organization'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Theme Switcher */}
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#18181b] transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600 transition-transform rotate-0 hover:-rotate-12" />
          )}
        </button>

        {tenant && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#121214] text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#1f1f1f]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-medium truncate max-w-[150px]">{tenant.name}</span>
          </div>
        )}

        <Dropdown align="right" trigger={<Avatar name={user?.name} size="sm" status="online" />} items={userMenuItems} />
      </div>
    </header>
  );
};
