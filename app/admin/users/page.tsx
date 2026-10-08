'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CircleAlert, CircleStop, Search, Users } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/shared/ConfirmDialog';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { LoadingSkeleton } from '@/components/admin/shared/LoadingSkeleton';
import { PageHeader } from '@/components/admin/shared/PageHeader';
import { Pagination } from '@/components/admin/shared/Pagination';
import { Toast, useToast } from '@/components/admin/shared/Toast';
import { Avatar } from '@/components/layout/UserMenu';
import { Button } from '@/components/ui/Button';
import { inputClassName } from '@/components/ui/Input';
import { useAdminUsers } from '@/hooks/admin/useAdminUsers';
import { useDebounce } from '@/lib/hooks';
import { cn, formatCurrency } from '@/lib/utils';
import type { AdminUser } from '@/types/admin';

const PAGE_SIZE = 20;

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [endTarget, setEndTarget] = useState<AdminUser | null>(null);
  const [ending, setEnding] = useState(false);
  const toast = useToast();
  const debouncedQ = useDebounce(q, 350);
  const { users, total, isLoading, error, disableUser } = useAdminUsers({ q: debouncedQ, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={isLoading ? 'Loading accounts…' : `${total.toLocaleString()} registered account${total === 1 ? '' : 's'}`}
        icon={Users}
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
        <label htmlFor="user-search" className="sr-only">
          Search users
        </label>
        <input
          id="user-search"
          type="search"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
          placeholder="Search by name or email…"
          className={cn(inputClassName, 'h-11 pl-11')}
        />
      </div>

      <div className="surface-card overflow-hidden">
        {isLoading ? (
          <LoadingSkeleton rows={8} />
        ) : error ? (
          <EmptyState tone="danger" icon={<CircleAlert />} title="Could not load users" description="Make sure you are signed in with an admin account." />
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={debouncedQ ? 'No users match your search' : 'No registered users yet'}
            description={debouncedQ ? 'Try a different name or email.' : 'Accounts appear here after shoppers sign up.'}
          />
        ) : (
          <div className="custom-scrollbar relative overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <caption className="sr-only">Registered users</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium text-ink-subtle">
                  <th scope="col" className="py-3 pl-5 pr-4">User</th>
                  <th scope="col" className="px-4 py-3">Joined</th>
                  <th scope="col" className="px-4 py-3 text-right">Sessions</th>
                  <th scope="col" className="px-4 py-3 text-right">Total spent</th>
                  <th scope="col" className="py-3 pl-4 pr-5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((user) => {
                  const name = user.name || user.email?.split('@')[0] || user.phoneNumber || 'Unnamed user';
                  return (
                    <tr key={user.id} className="transition-colors hover:bg-surface-muted/60">
                      <td className="py-3 pl-5 pr-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={name} image={user.image} />
                          <div className="min-w-0">
                            <p className="max-w-[16rem] truncate font-medium text-ink">{name}</p>
                            <p className="max-w-[16rem] truncate text-xs text-ink-subtle">{user.email || user.phoneNumber || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{format(new Date(user.createdAt), 'd MMM yyyy')}</td>
                      <td className="tabular px-4 py-3 text-right text-ink">{user.totalSessions}</td>
                      <td className="tabular px-4 py-3 text-right text-ink">{formatCurrency(user.totalSpent)}</td>
                      <td className="py-3 pl-4 pr-5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEndTarget(user)} aria-label={`End active sessions for ${name}`}>
                          <CircleStop aria-hidden="true" />
                          <span className="hidden sm:inline">End sessions</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />}

      <ConfirmDialog
        open={!!endTarget}
        onClose={() => setEndTarget(null)}
        title="End this user's active sessions?"
        description="Any cart session they currently have open will be disconnected. Their account and history are kept."
        confirmLabel="End sessions"
        loading={ending}
        onConfirm={async () => {
          if (!endTarget) return;
          setEnding(true);
          await disableUser(endTarget.id);
          setEnding(false);
          setEndTarget(null);
          toast.show('Active sessions ended');
        }}
      />

      <Toast message={toast.message} />
    </div>
  );
}
