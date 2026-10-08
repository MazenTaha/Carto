'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronRight,
  ClipboardList,
  CreditCard,
  History,
  ListChecks,
  ListPlus,
  Plus,
  ScanLine,
  ShoppingCart,
  UserRound,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/LoadingState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';

const HOW_IT_WORKS = [
  { icon: ListChecks, title: 'Pick a list', text: 'Choose a saved list with items in it.' },
  { icon: ScanLine, title: 'Scan the cart QR', text: 'Link the list to the cart display.' },
  { icon: CreditCard, title: 'Check out', text: 'Scan the payment QR and pay securely.' },
];

const SHORTCUTS = [
  { href: '/lists/new', icon: ListPlus, title: 'Create a list', text: 'Plan your next trip' },
  { href: '/history', icon: History, title: 'Receipts', text: 'Past shopping sessions' },
  { href: '/profile', icon: UserRound, title: 'Profile', text: 'Account and photo' },
];

type RecentListItem = {
  id: string;
  name: string;
  items: Array<{
    id: string;
    isCollected: boolean;
  }>;
};

type ActiveSessionSummary = {
  sessionId: string;
  status: string;
  cartCode: string;
  cartStatus: string;
  receiptId: string | null;
  shoppingList: {
    id: string;
    name: string;
    itemsCount: number;
  };
};

type DashboardPageClientProps = {
  isGuest: boolean;
  userName: string;
  stats: {
    totalSpent: number;
    savedLists: number;
  };
  recentLists: RecentListItem[];
  initialActiveSession: ActiveSessionSummary | null;
};

type CurrentSessionResponse =
  | { success: true; data: { active: false } }
  | { success: true; data: { active: true; session: ActiveSessionSummary } }
  | { success: false; error?: string | { message?: string } };

function readApiErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'object' && payload !== null) {
    const data = payload as { error?: string | { message?: string } };

    if (typeof data.error === 'string') {
      return data.error;
    }

    if (typeof data.error?.message === 'string') {
      return data.error.message;
    }
  }

  return fallback;
}

export function DashboardPageClient({
  isGuest,
  userName,
  stats,
  recentLists,
  initialActiveSession,
}: DashboardPageClientProps) {
  const [activeSession, setActiveSession] = useState<ActiveSessionSummary | null>(initialActiveSession);
  const [isCheckingActiveSession, setIsCheckingActiveSession] = useState(!initialActiveSession);

  const refreshActiveSession = useCallback(async () => {
    try {
      const response = await fetch('/api/cart/current-session', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      const payload: CurrentSessionResponse = await response.json().catch(() => ({ success: false }));

      if (!response.ok || payload?.success === false) {
        throw new Error(readApiErrorMessage(payload, 'Could not check the current cart session.'));
      }

      if (payload.data.active) {
        setActiveSession(payload.data.session);
      } else {
        setActiveSession(null);
      }
    } catch {
      setActiveSession((current) => current ?? initialActiveSession);
    } finally {
      setIsCheckingActiveSession(false);
    }
  }, [initialActiveSession]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const refreshIfMounted = async () => {
      await refreshActiveSession();
      if (cancelled) {
        return;
      }
    };

    void refreshIfMounted();

    const handleWindowFocus = () => {
      void refreshIfMounted();
    };

    const handlePageShow = () => {
      void refreshIfMounted();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshIfMounted();
      }
    };

    if (activeSession) {
      intervalId = window.setInterval(() => {
        void refreshIfMounted();
      }, 4000);
    }

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeSession, refreshActiveSession]);

  const hasActiveSession = Boolean(activeSession);
  const showNormalFlow = !hasActiveSession && !isCheckingActiveSession;
  const firstName = userName.split(' ')[0];

  return (
    <AppShell>
      <PageHeader
        title={isGuest ? 'Welcome to Carto' : `Welcome back, ${firstName}`}
        description={
          hasActiveSession
            ? 'Your cart is connected. Pick up where you left off.'
            : 'Plan a list, scan a cart, and check out without the queue.'
        }
        eyebrow={isGuest ? <Badge tone="neutral">Guest mode</Badge> : undefined}
        actions={
          !hasActiveSession && (
            <ButtonLink href="/lists/new" prefetch={false} variant="outline" className="hidden sm:inline-flex">
              <Plus aria-hidden="true" />
              New list
            </ButtonLink>
          )
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {isCheckingActiveSession && !hasActiveSession ? (
          <div className="surface-card p-6 lg:col-span-2" aria-busy="true">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-4 h-8 w-2/3" />
            <Skeleton className="mt-3 h-4 w-1/2" />
            <Skeleton className="mt-6 h-11 w-40" />
            <span className="sr-only">Checking your current cart session…</span>
          </div>
        ) : hasActiveSession && activeSession ? (
          <section
            aria-labelledby="live-session-title"
            className="relative overflow-hidden rounded-3xl bg-primary p-6 text-white shadow-raised sm:p-8 lg:col-span-2"
          >
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/50 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <Badge tone="inverse" pulse>
                  Cart connected
                </Badge>
                <h2 id="live-session-title" className="mt-4 truncate text-2xl font-bold text-white sm:text-3xl">
                  {activeSession.shoppingList.name}
                </h2>
                <p className="mt-1.5 text-sm text-white/75">
                  Linked to {activeSession.cartCode} · {activeSession.shoppingList.itemsCount} item
                  {activeSession.shoppingList.itemsCount === 1 ? '' : 's'} · {activeSession.cartStatus.replace('_', ' ').toLowerCase()}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <ButtonLink
                  href={`/session?sessionId=${encodeURIComponent(activeSession.sessionId)}`}
                  prefetch={false}
                  variant="inverse"
                  size="lg"
                >
                  <ShoppingCart aria-hidden="true" />
                  Continue session
                </ButtonLink>
                <ButtonLink
                  href={`/session/ready?sessionId=${encodeURIComponent(activeSession.sessionId)}`}
                  prefetch={false}
                  size="lg"
                  className="border border-white/25 bg-white/10 text-white shadow-none hover:bg-white/20"
                >
                  Go to checkout
                  <ArrowRight aria-hidden="true" />
                </ButtonLink>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section
              aria-labelledby="start-shopping-title"
              className="relative overflow-hidden rounded-3xl bg-primary p-6 text-white shadow-raised sm:p-8"
            >
              <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/50 blur-3xl" aria-hidden="true" />
              <div className="relative">
                <Badge tone="inverse">Smart cart ready</Badge>
                <h2 id="start-shopping-title" className="mt-4 text-2xl font-bold text-white sm:text-3xl">
                  Ready to shop?
                </h2>
                <p className="mt-1.5 max-w-md text-sm leading-6 text-white/75">
                  Choose a saved list and scan the QR code on any Carto cart. Your list shows up on the cart display.
                </p>
                <ButtonLink href="/lists?activate=1" prefetch={false} variant="inverse" size="lg" className="mt-6">
                  <ScanLine aria-hidden="true" />
                  Start shopping
                </ButtonLink>
              </div>
            </section>

            <section aria-labelledby="how-it-works" className="surface-card p-5 sm:p-6">
              <h2 id="how-it-works" className="text-base font-semibold">
                How it works
              </h2>
              <ol className="mt-4 space-y-4">
                {HOW_IT_WORKS.map(({ icon: Icon, title, text }, index) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-primary">
                      <Icon className="size-[1.125rem]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        <span className="sr-only">Step {index + 1}: </span>
                        {title}
                      </p>
                      <p className="text-sm text-ink-muted">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>

      {(showNormalFlow || hasActiveSession) && (
        <section aria-labelledby="recent-lists" className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 id="recent-lists" className="text-xl font-semibold">
                Recent lists
              </h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                {stats.savedLists} saved list{stats.savedLists === 1 ? '' : 's'}
              </p>
            </div>
            {recentLists.length > 0 && (
              <Link href="/lists" prefetch={false} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                View all
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </div>

          {recentLists.length === 0 ? (
            <EmptyState
              icon={ListPlus}
              title="No shopping lists yet"
              description="Create your first list, then activate it when you are ready to link a cart."
              actionLabel={hasActiveSession ? undefined : 'Create a list'}
              actionHref={hasActiveSession ? undefined : '/lists/new'}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {recentLists.map((list) => {
                const totalItems = list.items.length;
                const collectedItems = list.items.filter((item) => item.isCollected).length;
                const percentage = totalItems > 0 ? Math.round((collectedItems / totalItems) * 100) : 0;
                const isLive = activeSession?.shoppingList.id === list.id;

                return (
                  <li key={list.id}>
                    <Link
                      href={`/lists/${list.id}`}
                      prefetch={false}
                      className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-muted transition group-hover:bg-brand-50 group-hover:text-primary">
                          <ClipboardList className="size-5" aria-hidden="true" />
                        </span>
                        {isLive && (
                          <Badge tone="success" dot>
                            On cart
                          </Badge>
                        )}
                      </div>
                      <h3 className="mt-4 truncate font-sans text-[0.9375rem] font-semibold text-ink">{list.name}</h3>
                      <p className="mt-0.5 text-sm text-ink-subtle">
                        {totalItems} item{totalItems === 1 ? '' : 's'}
                        {collectedItems > 0 ? ` · ${collectedItems} collected` : ''}
                      </p>
                      {collectedItems > 0 && <ProgressBar value={percentage} size="sm" className="mt-3" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {showNormalFlow && (
        <section aria-labelledby="shortcuts" className="mt-10">
          <h2 id="shortcuts" className="mb-4 text-xl font-semibold">
            Shortcuts
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {SHORTCUTS.map(({ href, icon: Icon, title, text }) => (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={false}
                  className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-xs transition hover:border-brand-200 hover:shadow-card"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    <span className="block truncate text-sm text-ink-subtle">{text}</span>
                  </span>
                  <ChevronRight className="size-4 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
