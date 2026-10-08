'use client';

import { useAdminSessions } from '@/hooks/admin/useAdminSessions';
import { SessionsLiveTable } from '@/components/admin/sessions/SessionsLiveTable';
import { PageHeader } from '@/components/admin/shared/PageHeader';
import { LoadingSkeleton } from '@/components/admin/shared/LoadingSkeleton';
import { Activity } from 'lucide-react';
import { Pagination } from '@/components/admin/shared/Pagination';
import { Toast, useToast } from '@/components/admin/shared/Toast';
import { Badge } from '@/components/ui/Badge';
import { ChipTabs } from '@/components/ui/ChipTabs';
import { useState } from 'react';

const TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Checked out', value: 'CHECKED_OUT' },
  { label: 'Disconnected', value: 'DISCONNECTED' },
];

export default function SessionsPage() {
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const toast = useToast();

  const { sessions, total, isLoading, endSession } = useAdminSessions({
    status: statusFilter || undefined,
    page,
    pageSize: 20,
  });


  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        description="Shopping sessions across all carts, refreshed every 5 seconds."
        icon={Activity}
        actions={
          <Badge tone="success" pulse>
            Live
          </Badge>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ChipTabs
          ariaLabel="Filter by status"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={TABS}
        />
        <p className="tabular shrink-0 text-sm text-ink-muted">
          {total} session{total !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="surface-card overflow-hidden">
        {isLoading ? (
          <LoadingSkeleton rows={8} />
        ) : (
          <SessionsLiveTable
            sessions={sessions}
            onEndSession={async (id) => {
              await endSession(id);
              toast.show('Session ended — cart released');
            }}
          />
        )}
      </div>

      {total > 20 && <Pagination page={page} totalPages={Math.ceil(total / 20)} total={total} onChange={setPage} />}

      <Toast message={toast.message} />
    </div>
  );
}
