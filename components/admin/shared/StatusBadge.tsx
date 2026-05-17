import { cn } from '@/lib/utils';

type StatusVariant =
  | 'AVAILABLE'
  | 'IN_USE'
  | 'MAINTENANCE'
  | 'OFFLINE'
  | 'ACTIVE'
  | 'DISCONNECTED'
  | 'COMPLETED'
  | 'CHECKED_OUT'
  | 'DRAFT'
  | 'PAID'
  | 'PENDING'
  | 'FAILED'
  | string;

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  AVAILABLE:    { label: 'Available',    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  IN_USE:       { label: 'In Use',       className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  MAINTENANCE:  { label: 'Maintenance',  className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  OFFLINE:      { label: 'Offline',      className: 'bg-red-50 text-red-700 ring-red-200' },
  ACTIVE:       { label: 'Active',       className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  DISCONNECTED: { label: 'Disconnected', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  COMPLETED:    { label: 'Completed',    className: 'bg-slate-50 text-slate-600 ring-slate-200' },
  CHECKED_OUT:  { label: 'Checked Out',  className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  DRAFT:        { label: 'Draft',        className: 'bg-slate-50 text-slate-600 ring-slate-200' },
  PAID:         { label: 'Paid',         className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  PENDING:      { label: 'Pending',      className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  FAILED:       { label: 'Failed',       className: 'bg-red-50 text-red-700 ring-red-200' },
};

interface StatusBadgeProps {
  status: StatusVariant;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, pulse = false, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-slate-50 text-slate-600 ring-slate-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        config.className,
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {config.label}
    </span>
  );
}
