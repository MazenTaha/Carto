'use client';

import { AdminSessionRow } from '@/types/admin';
import { StatusBadge } from '@/components/admin/shared/StatusBadge';
import { ConfirmDialog } from '@/components/admin/shared/ConfirmDialog';
import { isActiveCartSessionStatus } from '@/lib/cart-session-status';
import { useState } from 'react';
import { formatDistanceToNow, formatDistance } from 'date-fns';
import { ShoppingCart, User, Clock, DollarSign, StopCircle, ChevronDown, ChevronRight } from 'lucide-react';

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
      <div className="flex flex-col items-center py-16 text-center text-slate-400">
        <ShoppingCart size={36} className="mb-3 opacity-20" />
        <p className="text-sm font-medium">No sessions found</p>
        <p className="text-xs mt-1">Active sessions will appear here in real time.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {sessions.map((s) => {
          const isExpanded = expanded === s.id;
          const isActive = isActiveCartSessionStatus(s.status);
          return (
            <div
              key={s.id}
              className={`rounded-xl border transition-all ${
                isActive ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-white'
              }`}
            >
              {/* Row */}
              <div
                className="flex cursor-pointer items-center gap-4 px-4 py-3"
                onClick={() => setExpanded(isExpanded ? null : s.id)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-600">
                  {s.cartCode.slice(-3)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 truncate">
                      {s.userName ?? s.userEmail ?? 'Guest'}
                    </span>
                    <StatusBadge status={s.status} pulse={isActive} />
                  </div>
                  <p className="text-xs text-slate-400 truncate">{s.listName}</p>
                </div>

                <div className="hidden sm:flex items-center gap-5 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={12} />
                    {s.durationSeconds != null ? formatDuration(s.durationSeconds) : '—'}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <DollarSign size={12} />
                    {(s.total ?? 0).toFixed(2)}
                  </div>
                  {isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEndTarget(s); }}
                      className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <StopCircle size={12} /> End
                    </button>
                  )}
                </div>

                {isExpanded ? (
                  <ChevronDown size={14} className="text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-slate-100 grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4 text-xs">
                  <div>
                    <p className="text-slate-400 font-semibold uppercase tracking-wider">Cart</p>
                    <p className="font-mono font-bold text-slate-800 mt-0.5">{s.cartCode}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold uppercase tracking-wider">Customer</p>
                    <p className="font-medium text-slate-800 mt-0.5 truncate">{s.userEmail ?? 'Guest'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold uppercase tracking-wider">Items</p>
                    <p className="font-medium text-slate-800 mt-0.5">{s.collectedCount ?? 0} / {s.itemCount ?? 0} collected</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold uppercase tracking-wider">Started</p>
                    <p className="font-medium text-slate-800 mt-0.5">
                      {formatDistanceToNow(new Date(s.startedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!endTarget}
        onClose={() => setEndTarget(null)}
        title="Force-end this session?"
        description={`Cart ${endTarget?.cartCode} will be released and marked as Available.`}
        confirmLabel="End Session"
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
