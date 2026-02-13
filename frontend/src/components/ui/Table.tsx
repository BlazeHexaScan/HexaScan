import { ReactNode } from 'react';
import { clsx } from 'clsx';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  className?: string;
}

/**
 * Table component with customizable columns and row click handling
 */
export function Table<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available',
  isLoading = false,
  className,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {columns.map((column) => (
              <th
                key={column.key}
                className={clsx(
                  'px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                  !column.align && 'text-left'
                )}
                style={{ width: column.width }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={clsx(
                'transition-colors',
                onRowClick &&
                  'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50'
              )}
            >
              {columns.map((column) => (
                <td
                  key={`${item.id}-${column.key}`}
                  className={clsx(
                    'px-4 py-4 text-sm text-gray-900 dark:text-gray-100',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right'
                  )}
                >
                  {column.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
