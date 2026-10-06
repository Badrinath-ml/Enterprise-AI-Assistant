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
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    primary: 'bg-slate-900 text-white border-slate-900',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border tracking-wide uppercase ${sizeStyles[size]} ${variantStyles[resolvedVariant]} ${className}`}
    >
      {children}
    </span>
  );
};
