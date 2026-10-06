import React from 'react';
import { getInitials } from '../../utils/formatters';

export interface AvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline' | 'busy';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = 'User',
  size = 'md',
  status,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'w-7 h-7 text-xs font-medium',
    md: 'w-9 h-9 text-sm font-semibold',
    lg: 'w-12 h-12 text-base font-semibold',
  };

  const statusDotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  const statusColors = {
    online: 'bg-emerald-500 ring-white',
    offline: 'bg-slate-400 ring-white',
    busy: 'bg-rose-500 ring-white',
  };

  const initials = getInitials(name);

  // Consistent background tint derived from name string
  const getBgColor = (text: string) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'bg-slate-700 text-white',
      'bg-indigo-700 text-white',
      'bg-teal-700 text-white',
      'bg-emerald-700 text-white',
      'bg-violet-700 text-white',
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}>
      <div
        className={`rounded-full flex items-center justify-center select-none shadow-xs ${sizeStyles[size]} ${getBgColor(
          name
        )}`}
      >
        {initials}
      </div>
      {status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ${statusDotSizes[size]} ${statusColors[status]}`}
        />
      )}
    </div>
  );
};
