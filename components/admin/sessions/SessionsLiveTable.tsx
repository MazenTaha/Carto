'use client';

import { AdminSessionRow } from '@/types/admin';
import { StatusBadge } from '@/components/admin/shared/StatusBadge';
import { ConfirmDialog } from '@/components/admin/shared/ConfirmDialog';
import { isActiveCartSessionStatus } from '@/lib/cart-session-status';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, CircleStop, Clock, ShoppingCart } from 'lucide-react';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';

interface SessionsLiveTableProps {
  sessions: AdminSessionRow[];
  onEndSession: (id: string) => Promise<void>;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function SessionsLiveTable({ sessions, onEndSession }: SessionsLiveTableProps) {
  const [endTarget, setEndTarget] = useState<AdminSessionRow | null>(null);
  const [ending, setEnding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!sessions.length) {
    return (
      <EmptyState
        icon={<ShoppingCart />}
        title="No sessions found"
        description="Sessions matching this filter will appear here in real time."
      />
    );
  }

  return (
    <>
      <ul className="divide-y divide-line">
        {sessions.map((s) => {
          const isExpanded = expanded === s.id;
          const isActive = isActiveCartSessionStatus(s.status);
          const detailsId = `session-details-${s.id}`;

          return (
            <li key={s.id} className={isActive ? 'bg-brand-50/30' : undefined}>
              <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : s.id)}
                  aria-expanded={isExpanded}
                  aria-controls={detailsId}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left sm:gap-4"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted font-mono text-xs font-semibold text-ink-muted">
                    {s.cartCode.slice(-2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-semibold text-ink">{s.userName ?? s.userEmail ?? 'Guest'}</span>
                      <StatusBadge status={s.status} pulse={isActive} />
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-subtle">
                      {s.listName} · <span className="font-mono">{s.cartCode}</span>
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-5 text-xs text-ink-muted md:flex">
                    <span className="tabular flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {s.durationSeconds != null ? formatDuration(s.durationSeconds) : '—'}
                    </span>
                    <span className="tabular w-24 text-right font-medium text-ink">{formatCurrency(s.total ?? 0)}</span>
                  </span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-ink-subtle transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {isActive && (
                  <Button variant="danger-soft" size="sm" onClick={() => setEndTarget(s)} aria-label={`End session on ${s.cartCode}`}>
                    <CircleStop aria-hidden="true" />
                    <span className="hidden sm:inline">End</span>
                  </Button>
                )}
              </div>

              {isExpanded && (
                <dl id={detailsId} className="grid grid-cols-2 gap-3 border-t border-line px-4 py-3 text-xs sm:grid-cols-4 sm:px-5">
                  <div>
                    <dt className="text-ink-subtle">Customer</dt>
                    <dd className="mt-0.5 truncate font-medium text-ink">{s.userEmail ?? 'Guest'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">Items</dt>
                    <dd className="tabular mt-0.5 font-medium text-ink">
                      {s.collectedCount ?? 0} / {s.itemCount ?? 0} collected
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">Started</dt>
                    <dd className="mt-0.5 font-medium text-ink">{formatDistanceToNow(new Date(s.startedAt), { addSuffix: true })}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">Total · duration</dt>
                    <dd className="tabular mt-0.5 font-medium text-ink">
                      {formatCurrency(s.total ?? 0)} · {s.durationSeconds != null ? formatDuration(s.durationSeconds) : '—'}
                    </dd>
                  </div>
                </dl>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={!!endTarget}
        onClose={() => setEndTarget(null)}
        title="Force-end this session?"
        description={`Cart ${endTarget?.cartCode} will be released and marked as available.`}
        confirmLabel="End session"
        loading={ending}
        onConfirm={async () => {
          if (!endTarget) return;
          setEnding(true);
          await onEndSession(endTarget.id);
          setEnding(false);
          setEndTarget(null);
        }}
      />
    </>
  );
}
