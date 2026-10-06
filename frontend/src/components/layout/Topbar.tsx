import React from 'react';
import { Menu, LogOut, UserCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../common/Avatar';
import { Dropdown } from '../common/Dropdown';

interface TopbarProps { onToggleMobileMenu: () => void; }

export const Topbar: React.FC<TopbarProps> = ({ onToggleMobileMenu }) => {
  const { user, tenant, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const getPageTitle = (path: string) => {
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/users')) return 'Users';
    if (path.startsWith('/team')) return 'My Team';
    if (path.startsWith('/departments')) return 'Departments';
    if (path.startsWith('/documents')) return 'Documents';
    if (path.startsWith('/profile')) return 'Profile';
    return 'Enterprise Assistant';
  };

  const userMenuItems = [
    { label: 'Your Profile', icon: <UserCircle className="w-4 h-4" />, onClick: () => navigate('/profile') },
    { label: 'Sign Out', icon: <LogOut className="w-4 h-4" />, onClick: () => { logout(); navigate('/login'); }, danger: true },
  ];

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-10">
      <div className="flex items-center gap-3">
        <button onClick={onToggleMobileMenu} className="lg:hidden p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100" aria-label="Toggle Navigation">
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{getPageTitle(location.pathname)}</h2>
          <p className="text-[11px] text-slate-400 hidden sm:block">{tenant?.name || 'Organization'}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {tenant && <div className="hidden sm:block text-[11px] text-slate-600"><span className="text-slate-400">Organization:</span> <span className="font-semibold text-slate-900">{tenant.name}</span></div>}
        <Dropdown align="right" trigger={<Avatar name={user?.name} size="sm" />} items={userMenuItems} />
      </div>
    </header>
  );
};
