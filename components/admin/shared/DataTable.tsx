'use client';

import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  className?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  className,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-xl border border-slate-200 bg-white', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500',
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row) => (
            <tr
              key={String(row[keyField])}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'transition-colors duration-150',
                onRowClick ? 'cursor-pointer hover:bg-indigo-50/50' : 'hover:bg-slate-50/60'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn('px-4 py-3 text-slate-700', col.className)}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
