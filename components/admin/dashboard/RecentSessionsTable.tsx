import { AdminSessionRow } from '@/types/admin';
import { StatusBadge } from '@/components/admin/shared/StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { ShoppingCart, User } from 'lucide-react';
import { isActiveCartSessionStatus } from '@/lib/cart-session-status';

interface RecentSessionsTableProps {
  sessions: AdminSessionRow[];
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function RecentSessionsTable({ sessions }: RecentSessionsTableProps) {
  if (!sessions.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
        <ShoppingCart size={32} className="mb-2 opacity-30" />
        <p className="text-sm">No recent sessions</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Cart</th>
            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Customer</th>
            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">List</th>
            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Duration</th>
            <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sessions.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50/60">
              <td className="py-3 pr-4">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-700">
                  <ShoppingCart size={10} />
                  {s.cartCode}
                </span>
              </td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <User size={11} />
                  </div>
                  <span className="max-w-[120px] truncate text-slate-700">
                    {s.userName ?? s.userEmail ?? 'Guest'}
                  </span>
                </div>
              </td>
              <td className="py-3 pr-4 max-w-[140px] truncate text-slate-600">{s.listName}</td>
              <td className="py-3 pr-4">
                <StatusBadge
                  status={s.status}
                  pulse={isActiveCartSessionStatus(s.status)}
                />
              </td>
              <td className="py-3 pr-4 text-slate-500 text-xs">
                {s.durationSeconds != null ? formatDuration(s.durationSeconds) : '—'}
              </td>
              <td className="py-3 text-right font-semibold text-slate-800">
                ${(s.total ?? 0).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
