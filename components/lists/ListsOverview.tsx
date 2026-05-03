'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDaysUntilPermanentDelete } from '@/lib/list-retention';
import { cn } from '@/lib/utils';

export interface ListOverviewItem {
  id: string;
  name: string;
  updatedAt: string | null;
  deletedAt: string | null;
  permanentDeleteAt: string | null;
  _count?: {
    items: number;
  };
}

interface ListsOverviewProps {
  lists: ListOverviewItem[];
  deletedLists: ListOverviewItem[];
  isActivationFlow: boolean;
}

function getPermanentDeleteAt(deletedAt = new Date()) {
  const permanentDeleteAt = new Date(deletedAt);
  permanentDeleteAt.setDate(permanentDeleteAt.getDate() + 30);
  return permanentDeleteAt.toISOString();
}

export function ListsOverview({
  lists,
  deletedLists,
  isActivationFlow,
}: ListsOverviewProps) {
  const [activeLists, setActiveLists] = useState(lists);
  const [recentlyDeletedLists, setRecentlyDeletedLists] = useState(deletedLists);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingRecoverId, setPendingRecoverId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setActiveLists(lists);
  }, [lists]);

  useEffect(() => {
    setRecentlyDeletedLists(deletedLists);
  }, [deletedLists]);

  const busyListId = pendingDeleteId || pendingRecoverId || openingId;

  const handleDelete = async (list: ListOverviewItem) => {
    if (busyListId) return;

    if (confirmingDeleteId !== list.id) {
      setConfirmingDeleteId(list.id);
      setError('');
      return;
    }

    const deletedAt = new Date().toISOString();
    const deletedList = {
      ...list,
      deletedAt,
      permanentDeleteAt: list.permanentDeleteAt || getPermanentDeleteAt(new Date(deletedAt)),
    };
    const previousActiveLists = activeLists;
    const previousDeletedLists = recentlyDeletedLists;

    setPendingDeleteId(list.id);
    setConfirmingDeleteId(null);
    setError('');
    setActiveLists((current) => current.filter((entry) => entry.id !== list.id));
    setRecentlyDeletedLists((current) => [deletedList, ...current]);

    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete list');
      }
    } catch {
      setActiveLists(previousActiveLists);
      setRecentlyDeletedLists(previousDeletedLists);
      setError(`Could not move "${list.name}" to Recently deleted.`);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleRecover = async (list: ListOverviewItem) => {
    if (busyListId) return;

    const restoredList = {
      ...list,
      deletedAt: null,
      permanentDeleteAt: null,
    };
    const previousActiveLists = activeLists;
    const previousDeletedLists = recentlyDeletedLists;

    setPendingRecoverId(list.id);
    setError('');
    setRecentlyDeletedLists((current) => current.filter((entry) => entry.id !== list.id));
    setActiveLists((current) => [restoredList, ...current]);

    try {
      const response = await fetch(`/api/lists/${list.id}/restore`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to recover list');
      }
    } catch {
      setActiveLists(previousActiveLists);
      setRecentlyDeletedLists(previousDeletedLists);
      setError(`Could not recover "${list.name}".`);
    } finally {
      setPendingRecoverId(null);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {activeLists.length === 0 ? (
        <EmptyState
          icon="format_list_bulleted_add"
          title="No shopping lists yet"
          description="Create a list first. When you are ready to shop, activate it and scan the QR code on your cart."
          actionLabel="Create your first list"
          actionHref="/lists/new"
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeLists.map((list) => {
            const count = list._count?.items || 0;
            const href = isActivationFlow ? `/session/start?listId=${list.id}` : `/lists/${list.id}`;
            const updatedAt = list.updatedAt ? formatDistanceToNow(new Date(list.updatedAt), { addSuffix: true }) : 'recently';
            const isOpening = openingId === list.id;
            const isConfirmingDelete = confirmingDeleteId === list.id;
            const isBusy = busyListId !== null;

            return (
              <article
                key={list.id}
                className={cn(
                  'group flex min-h-52 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-card transition duration-150 dark:border-slate-800 dark:bg-slate-900',
                  isOpening
                    ? 'scale-[0.99] border-primary/40 ring-4 ring-primary/10'
                    : 'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft'
                )}
              >
                <div>
                  <div className="mb-5 flex min-h-10 items-start justify-end">
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-2 rounded-full bg-red-50 p-1 text-xs font-black text-red-700 dark:bg-red-950/30 dark:text-red-300">
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          className="rounded-full px-3 py-2 transition hover:bg-white/80"
                          disabled={isBusy}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(list)}
                          className="rounded-full bg-red-600 px-3 py-2 text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isBusy}
                        >
                          {pendingDeleteId === list.id ? 'Moving...' : 'Confirm'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleDelete(list)}
                        disabled={isBusy}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition active:scale-95 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                        aria-label={`Delete ${list.name}`}
                        title="Delete list"
                      >
                        <span className="material-symbols-outlined text-[21px]">
                          {pendingDeleteId === list.id ? 'progress_activity' : 'delete'}
                        </span>
                      </button>
                    )}
                  </div>
                  <Link
                    href={href}
                    onClick={() => setOpeningId(list.id)}
                    className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    prefetch
                  >
                    <h2 className="line-clamp-2 text-xl font-black text-slate-950 group-hover:text-primary dark:text-slate-100">
                      {list.name}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">{count} items - Updated {updatedAt}</p>
                  </Link>
                </div>

                <Link
                  href={href}
                  onClick={() => setOpeningId(list.id)}
                  className={cn(
                    'mt-6 flex items-center justify-between border-t border-slate-100 pt-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-800',
                    isOpening && 'text-primary'
                  )}
                  prefetch
                >
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {isOpening ? 'Opening...' : isActivationFlow ? 'Open QR scanner' : 'Manage list'}
                  </span>
                  <span
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition dark:bg-slate-800',
                      isOpening ? 'bg-primary text-white' : 'group-hover:bg-primary group-hover:text-white'
                    )}
                  >
                    <span className={cn('material-symbols-outlined', isOpening && 'animate-spin')}>
                      {isOpening ? 'progress_activity' : 'arrow_forward'}
                    </span>
                  </span>
                </Link>
              </article>
            );
          })}
        </section>
      )}

      {recentlyDeletedLists.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">Recently deleted</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">Lists waiting for permanent deletion</h2>
            </div>
            <Badge variant="warning">{recentlyDeletedLists.length} deleted</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recentlyDeletedLists.map((list) => {
              const count = list._count?.items || 0;
              const daysRemaining = list.permanentDeleteAt ? getDaysUntilPermanentDelete(list.permanentDeleteAt) : 30;
              const isRecovering = pendingRecoverId === list.id;

              return (
                <div
                  key={list.id}
                  className={cn(
                    'rounded-2xl border border-red-100 bg-red-50/70 p-4 text-slate-800 transition duration-150 dark:border-red-950/60 dark:bg-red-950/20 dark:text-slate-100',
                    isRecovering && 'scale-[0.99] opacity-70'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black">{list.name}</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{count} items</p>
                    </div>
                  </div>
                  <p className="mt-4 rounded-xl bg-white/70 px-3 py-2 text-sm font-bold text-red-700 dark:bg-slate-950/40 dark:text-red-300">
                    Permanently deletes in about {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                  </p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void handleRecover(list)}
                      disabled={busyListId !== null}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-primary shadow-sm transition active:scale-95 hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950/70"
                    >
                      {isRecovering ? 'Recovering...' : 'Recover'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
