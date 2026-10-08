import { AdminSessionRow } from '@/types/admin';
import { StatusBadge } from '@/components/admin/shared/StatusBadge';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { ShoppingCart } from 'lucide-react';
import { isActiveCartSessionStatus } from '@/lib/cart-session-status';
import { formatCurrency } from '@/lib/utils';

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function RecentSessionsTable({ sessions }: { sessions: AdminSessionRow[] }) {
  if (!sessions.length) {
    return <EmptyState icon={<ShoppingCart />} title="No recent sessions" description="Sessions appear here once shoppers link a cart." />;
  }

  return (
    <div className="custom-scrollbar relative overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">Recent shopping sessions</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs font-medium text-ink-subtle">
            <th scope="col" className="py-3 pl-5 pr-4">Cart</th>
            <th scope="col" className="px-4 py-3">Customer</th>
            <th scope="col" className="px-4 py-3">List</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Duration</th>
            <th scope="col" className="py-3 pl-4 pr-5 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sessions.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-surface-muted/60">
              <td className="py-3 pl-5 pr-4 font-mono text-xs font-medium text-ink">{s.cartCode}</td>
              <td className="max-w-[10rem] truncate px-4 py-3 text-ink">{s.userName ?? s.userEmail ?? 'Guest'}</td>
              <td className="max-w-[10rem] truncate px-4 py-3 text-ink-muted">{s.listName}</td>
              <td className="px-4 py-3">
                <StatusBadge status={s.status} pulse={isActiveCartSessionStatus(s.status)} />
              </td>
              <td className="tabular px-4 py-3 text-ink-muted">{s.durationSeconds != null ? formatDuration(s.durationSeconds) : '—'}</td>
              <td className="tabular py-3 pl-4 pr-5 text-right font-medium text-ink">{formatCurrency(s.total ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
