import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCircle,
  LogOut,
  FileText,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../common/Avatar';

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
    icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    name: 'Users',
    to: '/users',
    icon: <Users className="w-4 h-4 shrink-0" />,
    allowedRoles: ['ADMIN'],
  },
  {
    name: 'My Team',
    to: '/team',
    icon: <Users className="w-4 h-4 shrink-0" />,
    allowedRoles: ['MANAGER'],
  },
  {
    name: 'Departments',
    to: '/departments',
    icon: <Building2 className="w-4 h-4 shrink-0" />,
    allowedRoles: ['ADMIN'],
  },
  {
    name: 'Documents',
    to: '/documents',
    icon: <FileText className="w-4 h-4 shrink-0" />,
    allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    name: 'Assistant',
    to: '/chat',
    icon: <Sparkles className="w-4 h-4 shrink-0" />,
    allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    name: 'Profile',
    to: '/profile',
    icon: <UserCircle className="w-4 h-4 shrink-0" />,
    allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
];

interface SidebarProps {
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const items = navItems.filter((i) =>
    user?.role ? i.allowedRoles.includes(user.role) : false
  );

  return (
    <aside
      className={`bg-white dark:bg-[#0a0a0a] border-r border-slate-200 dark:border-[#1f1f1f] flex flex-col h-full select-none transition-all duration-200 ease-in-out ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 dark:border-[#1f1f1f] flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            <Shield className="w-5 h-5 text-indigo-100" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                Enterprise AI
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {tenant?.name || 'Workspace'}
              </p>
            </div>
          )}
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#18181b] transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-2 pb-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Workspace
          </div>
        )}

        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onCloseMobile}
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isCollapsed ? 'justify-center px-0' : ''
              } ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#18181b]'
              }`
            }
          >
            {item.icon}
            {!isCollapsed && <span className="truncate">{item.name}</span>}
          </NavLink>
        ))}
      </div>

      {/* User & Sign Out Footer */}
      <div className="p-3 border-t border-slate-100 dark:border-[#1f1f1f] bg-slate-50/60 dark:bg-[#070707]">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#1f1f1f] shadow-2xs mb-2">
            <Avatar name={user?.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {user?.email}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-2" title={user?.name || 'User'}>
            <Avatar name={user?.name} size="sm" />
          </div>
        )}

        <button
          onClick={handleLogout}
          title={isCollapsed ? 'Sign Out' : undefined}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
