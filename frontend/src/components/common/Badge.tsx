import React from 'react';
import { UserRole } from '../../types/auth';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'neutral' | 'success' | 'warning' | 'error' | 'primary' | 'purple' | 'blue';
  role?: UserRole | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  role,
  size = 'sm',
  className = '',
}) => {
  // If role is passed, map to appropriate semantic styling
  let resolvedVariant = variant || 'default';
  if (role) {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        resolvedVariant = 'purple';
        break;
      case 'MANAGER':
        resolvedVariant = 'blue';
        break;
      case 'EMPLOYEE':
        resolvedVariant = 'neutral';
        break;
      default:
        resolvedVariant = 'default';
    }
  }

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 font-medium tracking-wide',
    md: 'text-xs px-2.5 py-1 font-medium tracking-wide',
  };

  const variantStyles = {
    default:
      'bg-slate-100 dark:bg-[#182338] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#22314a]',
    neutral:
      'bg-zinc-100 dark:bg-zinc-800/70 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    primary:
      'bg-indigo-600 text-white border-indigo-500 shadow-2xs',
    success:
      'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
    warning:
      'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
    error:
      'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60',
    purple:
      'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
    blue:
      'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border uppercase ${sizeStyles[size]} ${variantStyles[resolvedVariant]} ${className}`}
    >
      {children}
    </span>
  );
};
