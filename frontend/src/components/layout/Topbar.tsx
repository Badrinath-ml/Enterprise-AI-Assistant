import React, { useEffect, useState } from 'react';
import { Menu, Server, LogOut, UserCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { systemApi } from '../../api/system';
import { Avatar } from '../common/Avatar';
import { Dropdown } from '../common/Dropdown';
import { Badge } from '../common/Badge';

interface TopbarProps {
  onToggleMobileMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleMobileMenu }) => {
  const { user, tenant, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [systemOnline, setSystemOnline] = useState<boolean | null>(null);

  // Derive page title from pathname
  const getPageTitle = (path: string) => {
    if (path.startsWith('/dashboard')) return 'Dashboard Overview';
    if (path.startsWith('/users')) return 'User Directory';
    if (path.startsWith('/departments')) return 'Departments';
    if (path.startsWith('/profile')) return 'Account Profile';
    return 'Knowledge Assistant';
  };

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await systemApi.getHealth();
        if (isMounted) setSystemOnline(res.status === 'UP');
      } catch {
        if (isMounted) setSystemOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const userMenuItems = [
    {
      label: 'Your Profile',
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
    <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-10">
      {/* Left: Mobile hamburger + breadcrumb / page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-sm font-semibold text-slate-900 leading-tight">
            {getPageTitle(location.pathname)}
          </h2>
          <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
            {location.pathname}
          </p>
        </div>
      </div>

      {/* Right: Tenant, System Health, User Menu */}
      <div className="flex items-center gap-3">
        {/* Backend health status indicator */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium"
          title={`Backend status: ${
            systemOnline === true ? 'Connected (UP)' : systemOnline === false ? 'Offline' : 'Checking...'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              systemOnline === true
                ? 'bg-emerald-500 animate-pulse'
                : systemOnline === false
                ? 'bg-rose-500'
                : 'bg-amber-400'
            }`}
          />
          <Server className="w-3 h-3 text-slate-400" />
          <span>{systemOnline === true ? 'Online' : systemOnline === false ? 'Offline' : 'Syncing'}</span>
        </div>

        {/* Tenant chip */}
        {tenant && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-[11px] font-medium text-slate-700">
            <span className="text-slate-400">Org:</span>
            <span className="font-semibold text-slate-900">{tenant.name}</span>
          </div>
        )}

        <Badge role={user?.role} size="sm">
          {user?.role}
        </Badge>

        {/* User avatar menu */}
        <Dropdown
          align="right"
          trigger={<Avatar name={user?.name} size="sm" className="hover:opacity-90 transition-opacity" />}
          items={userMenuItems}
        />
      </div>
    </header>
  );
};
