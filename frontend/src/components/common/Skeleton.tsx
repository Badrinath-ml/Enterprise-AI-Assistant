import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return <div className={`animate-pulse bg-slate-200 dark:bg-[#1f2d44] rounded-md ${className}`} />;
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => {
  return (
    <div className="w-full space-y-3 p-4">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-1/4" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2 border-t border-slate-100 dark:border-[#1f2d44]">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 w-1/4" />
          ))}
        </div>
      ))}
    </div>
  );
};
