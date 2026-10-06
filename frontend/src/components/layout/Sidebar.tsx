import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, UserCircle, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';

interface NavItemConfig {
  name: string;
  to: string;
  icon: React.ReactNode;
  allowedRoles: ('ADMIN' | 'MANAGER' | 'EMPLOYEE')[];
}

const navItems: NavItemConfig[] = [
  {
    name: 'Dashboard',
    to: '/dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    name: 'Users',
    to: '/users',
    icon: <Users className="w-4 h-4" />,
    allowedRoles: ['ADMIN'],
  },
  {
    name: 'Departments',
    to: '/departments',
    icon: <Building2 className="w-4 h-4" />,
    allowedRoles: ['ADMIN', 'MANAGER'],
  },
  {
    name: 'Profile',
    to: '/profile',
    icon: <UserCircle className="w-4 h-4" />,
    allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
];

export const Sidebar: React.FC<{ onCloseMobile?: () => void }> = ({ onCloseMobile }) => {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter((item) =>
    user?.role ? item.allowedRoles.includes(user.role) : false
  );

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider">
            EA
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-slate-900 tracking-tight truncate leading-tight">
              Enterprise Assistant
            </h1>
            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 font-mono">
              <Shield className="w-3 h-3 text-slate-400" />
              {tenant?.slug || 'workspace'}
            </p>
          </div>
        </div>
      </div>

      {/* Tenant Indicator Bar */}
      {tenant && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Tenant
          </span>
          <span className="text-xs font-semibold text-slate-800 truncate max-w-[130px]" title={tenant.name}>
            {tenant.name}
          </span>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Workspace
        </div>
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`
            }
          >
            {item.icon}
            <span>{item.name}</span>
          </NavLink>
        ))}
      </div>

      {/* User Section & Logout */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 p-2 rounded-md bg-white border border-slate-200 shadow-xs mb-2">
          <Avatar name={user?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.name || 'User'}</p>
              <Badge role={user?.role} size="sm">
                {user?.role}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 truncate" title={user?.email}>
              {user?.email}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
