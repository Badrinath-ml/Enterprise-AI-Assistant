import React from 'react';
import { TableSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onEmptyAction?: () => void;
  emptyActionText?: string;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display right now.',
  onEmptyAction,
  emptyActionText,
  className = '',
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-slate-200 overflow-hidden ${className}`}>
        <TableSkeleton rows={5} cols={columns.length} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={className}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionText={emptyActionText}
          onAction={onEmptyAction}
        />
      </div>
    );
  }

  const alignStyles = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`py-3 px-4 ${alignStyles[col.align || 'left']} ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {data.map((item, idx) => (
              <tr key={keyExtractor(item, idx)} className="hover:bg-slate-50/70 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3.5 px-4 ${alignStyles[col.align || 'left']} ${
                      col.className || ''
                    }`}
                  >
                    {col.render
                      ? col.render(item, idx)
                      : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
