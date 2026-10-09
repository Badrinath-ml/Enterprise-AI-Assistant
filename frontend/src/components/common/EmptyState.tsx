import React from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#111827] rounded-xl border border-dashed border-slate-300 dark:border-[#22314a] ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#182338] flex items-center justify-center text-slate-500 dark:text-slate-400 mb-3 border border-slate-200 dark:border-[#1f2d44]">
        {icon || <FolderOpen className="w-6 h-6 text-slate-400 dark:text-slate-500" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4 leading-relaxed">{description}</p>
      {actionText && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
