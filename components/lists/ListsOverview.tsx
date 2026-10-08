'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, ClipboardList, ListPlus, Loader2, Lock, RotateCcw, ScanLine, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
  activationDisabled?: boolean;
  activationDisabledMessage?: string;
  canCreateList?: boolean;
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
  activationDisabled = false,
  canCreateList = true,
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
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      )}

      {activeLists.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title={isActivationFlow ? 'No lists ready to activate' : 'No shopping lists yet'}
          description="Create a list first. When you are ready to shop, activate it and scan the QR code on your cart."
          actionLabel={canCreateList ? 'Create your first list' : undefined}
          actionHref={canCreateList ? '/lists/new' : undefined}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {activeLists.map((list) => {
            const count = list._count?.items || 0;
            const href = isActivationFlow ? `/session/start?listId=${list.id}` : `/lists/${list.id}`;
            const updatedAt = list.updatedAt ? formatDistanceToNow(new Date(list.updatedAt), { addSuffix: true }) : 'recently';
            const isOpening = openingId === list.id;
            const isConfirmingDelete = confirmingDeleteId === list.id;
            const isBusy = busyListId !== null;
            const activationIsLocked = isActivationFlow && activationDisabled;

            return (
              <li
                key={list.id}
                className={cn(
                  'group relative flex flex-col rounded-2xl border border-line bg-surface shadow-xs transition duration-150',
                  isOpening && 'border-brand-300 ring-4 ring-primary/10',
                  !activationIsLocked && !isOpening && 'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card',
                  activationIsLocked && 'opacity-70'
                )}
              >
                <div className="flex items-start gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-muted transition group-hover:bg-brand-50 group-hover:text-primary">
                    <ClipboardList className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {activationIsLocked ? (
                      <h2 className="line-clamp-2 font-sans text-base font-semibold text-ink">{list.name}</h2>
                    ) : (
                      <Link
                        href={href}
                        onClick={() => setOpeningId(list.id)}
                        prefetch
                        className="rounded-md after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-primary/70"
                      >
                        <h2 className="line-clamp-2 font-sans text-base font-semibold text-ink">{list.name}</h2>
                      </Link>
                    )}
                    <p className="mt-0.5 text-sm text-ink-subtle">
                      {count} item{count === 1 ? '' : 's'} · Updated {updatedAt}
                    </p>
                  </div>

                  <div className="relative z-10 -mr-1.5 -mt-1.5">
                    {!isConfirmingDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(list)}
                        disabled={isBusy}
                        className="flex size-10 items-center justify-center rounded-full text-ink-subtle transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        aria-label={`Delete ${list.name}`}
                        title="Delete list"
                      >
                        {pendingDeleteId === list.id ? (
                          <Loader2 className="size-[1.125rem] animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="size-[1.125rem]" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isConfirmingDelete ? (
                  <div
                    role="alertdialog"
                    aria-label={`Delete ${list.name}?`}
                    className="relative z-10 mx-3 mb-3 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2.5 animate-fade-in sm:mx-4 sm:mb-4"
                  >
                    <p className="text-sm font-medium text-red-800">Move to recently deleted?</p>
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmingDeleteId(null)} disabled={isBusy} className="text-red-800 hover:bg-red-100 hover:text-red-900">
                        Cancel
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void handleDelete(list)} disabled={isBusy} data-autofocus>
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
                    {activationIsLocked ? (
                      <span className="flex items-center gap-2 text-sm text-ink-subtle">
                        <Lock className="size-4 shrink-0" aria-hidden="true" />
                        Finish your current session first
                      </span>
                    ) : (
                      <>
                        <span className={cn('text-sm font-medium', isActivationFlow ? 'text-primary' : 'text-ink-muted')}>
                          {isOpening ? 'Opening…' : isActivationFlow ? 'Scan cart QR' : 'Open list'}
                        </span>
                        <span
                          className={cn(
                            'flex size-8 items-center justify-center rounded-full transition',
                            isActivationFlow || isOpening
                              ? 'bg-primary text-white'
                              : 'bg-surface-muted text-ink-muted group-hover:bg-primary group-hover:text-white'
                          )}
                          aria-hidden="true"
                        >
                          {isOpening ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : isActivationFlow ? (
                            <ScanLine className="size-4" />
                          ) : (
                            <ArrowRight className="size-4" />
                          )}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {recentlyDeletedLists.length > 0 && (
        <section aria-labelledby="recently-deleted" className="mt-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="recently-deleted" className="text-lg font-semibold">
                Recently deleted
              </h2>
              <p className="mt-0.5 text-sm text-ink-muted">Lists are removed permanently after 30 days.</p>
            </div>
            <Badge tone="neutral">{recentlyDeletedLists.length} deleted</Badge>
          </div>

          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {recentlyDeletedLists.map((list) => {
              const count = list._count?.items || 0;
              const daysRemaining = list.permanentDeleteAt ? getDaysUntilPermanentDelete(list.permanentDeleteAt) : 30;
              const isRecovering = pendingRecoverId === list.id;

              return (
                <li
                  key={list.id}
                  className={cn('flex items-center gap-3 px-4 py-3 transition sm:px-5', isRecovering && 'opacity-60')}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{list.name}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      {count} item{count === 1 ? '' : 's'} · Deletes in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRecover(list)}
                    disabled={busyListId !== null}
                    loading={isRecovering}
                  >
                    {!isRecovering && <RotateCcw aria-hidden="true" />}
                    {isRecovering ? 'Recovering…' : 'Recover'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
