'use client';

import { useAdminSessions } from '@/hooks/admin/useAdminSessions';
import { SessionsLiveTable } from '@/components/admin/sessions/SessionsLiveTable';
import { PageHeader } from '@/components/admin/shared/PageHeader';
import { LoadingSkeleton } from '@/components/admin/shared/LoadingSkeleton';
import { Activity, RefreshCw } from 'lucide-react';
import { useState } from 'react';

const TABS = [
  { label: 'All',        value: '' },
  { label: 'Active',     value: 'ACTIVE' },
  { label: 'Completed',  value: 'COMPLETED' },
  { label: 'Checked Out',value: 'CHECKED_OUT' },
  { label: 'Disconnected',value:'DISCONNECTED' },
];

export default function SessionsPage() {
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState('');

  const { sessions, total, isLoading, endSession } = useAdminSessions({
    status: statusFilter || undefined,
    page,
    pageSize: 20,
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Sessions"
        description="Monitoring active shopping sessions in real time"
        icon={Activity}
        actions={
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Polling every 5s
          </div>
        }
      />

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setStatusFilter(t.value); setPage(1); }}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              statusFilter === t.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-slate-400 flex items-center gap-1">
          <RefreshCw size={11} /> {total} session{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        {isLoading ? (
          <LoadingSkeleton rows={8} />
        ) : (
          <SessionsLiveTable
            sessions={sessions}
            onEndSession={async (id) => {
              await endSession(id);
              showToast('Session ended — cart released');
            }}
          />
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            Previous
          </button>
          <span className="self-center text-slate-500 text-xs">Page {page}</span>
          <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            Next
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
