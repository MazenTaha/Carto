import { Badge, type BadgeTone } from '@/components/ui/Badge';

const STATUS_CONFIG: Record<string, { label: string; tone: BadgeTone }> = {
  AVAILABLE: { label: 'Available', tone: 'success' },
  IN_USE: { label: 'In use', tone: 'brand' },
  MAINTENANCE: { label: 'Maintenance', tone: 'warning' },
  OFFLINE: { label: 'Offline', tone: 'danger' },
  ACTIVE: { label: 'Active', tone: 'success' },
  DISCONNECTED: { label: 'Disconnected', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
  CHECKED_OUT: { label: 'Checked out', tone: 'info' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
  LOCKED: { label: 'Locked', tone: 'neutral' },
  PAID: { label: 'Paid', tone: 'success' },
  PENDING: { label: 'Pending', tone: 'warning' },
  PROCESSING: { label: 'Processing', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
};

interface StatusBadgeProps {
  status: string;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, pulse = false, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status.replace(/_/g, ' ').toLowerCase(), tone: 'neutral' as BadgeTone };

  return (
    <Badge tone={config.tone} dot pulse={pulse} className={className}>
      {config.label}
    </Badge>
  );
}
