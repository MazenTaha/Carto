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
  caption?: string;
  /** Minimum table width before it scrolls horizontally; pass `none` when columns hide responsively. */
  minWidthClassName?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  className,
  onRowClick,
  caption,
  minWidthClassName = 'min-w-[36rem]',
}: DataTableProps<T>) {
  return (
    <div className={cn('custom-scrollbar relative w-full overflow-x-auto', className)}>
      <table className={cn('w-full text-sm', minWidthClassName)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn('whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-ink-subtle first:pl-5 last:pr-5', col.className)}
              >
                {col.label || <span className="sr-only">{col.key}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.map((row) => (
            <tr
              key={String(row[keyField])}
              onClick={() => onRowClick?.(row)}
              className={cn('transition-colors', onRowClick ? 'cursor-pointer hover:bg-brand-50/40' : 'hover:bg-surface-muted/60')}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3 text-ink-muted first:pl-5 last:pr-5', col.className)}>
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
