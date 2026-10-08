'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Camera, ChevronRight, ListChecks, ReceiptText, ScanLine, ShoppingCart, UserRound } from 'lucide-react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { AppShell } from '@/components/layout/AppShell';
import { AVATAR_CHANGED_EVENT, LOCAL_AVATAR_KEY } from '@/components/layout/UserMenu';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Skeleton } from '@/components/ui/LoadingState';
import { PageHeader } from '@/components/ui/PageHeader';

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

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [avatar, setAvatar] = useState('');
  const [activeSession, setActiveSession] = useState<ActiveSessionSummary | null>(null);
  const [isCheckingActiveSession, setIsCheckingActiveSession] = useState(true);

  useEffect(() => {
    let savedAvatar = '';
    try {
      savedAvatar = window.localStorage.getItem(LOCAL_AVATAR_KEY) || '';
    } catch {}
    if (savedAvatar) {
      setAvatar(savedAvatar);
      return;
    }

    if (session?.user?.image) {
      setAvatar(session.user.image);
    }
  }, [session?.user?.image]);

  const refreshActiveSession = useCallback(async () => {
    try {
      const response = await fetch('/api/cart/current-session', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      const payload: CurrentSessionResponse = await response.json().catch(() => ({ success: false }));

      if (!response.ok || payload.success === false) {
        throw new Error(readApiErrorMessage(payload, 'Could not check your current cart session.'));
      }

      if (payload.data.active) {
        setActiveSession(payload.data.session);
      } else {
        setActiveSession(null);
      }
    } catch (error: any) {
      setActiveSession(null);
    } finally {
      setIsCheckingActiveSession(false);
    }
  }, []);

  useEffect(() => {
    void refreshActiveSession();

    const handleWindowFocus = () => {
      void refreshActiveSession();
    };

    const handlePageShow = () => {
      void refreshActiveSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshActiveSession();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshActiveSession]);

  const handleAvatarChange = (file?: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      setAvatar(value);
      try {
        window.localStorage.setItem(LOCAL_AVATAR_KEY, value);
        window.dispatchEvent(new Event(AVATAR_CHANGED_EVENT));
      } catch {
        // Storage can be full or blocked (private mode); the preview still updates for this visit.
      }
    };
    reader.readAsDataURL(file);
  };

  const isSignedIn = status === 'authenticated';
  const displayName = session?.user?.name?.trim() || session?.user?.email?.trim() || 'Guest shopper';
  const emailLabel = session?.user?.email?.trim() || '';
  const initials = useMemo(
    () => displayName
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
    [displayName]
  );

  return (
    <AppShell maxWidth="lg">
      <PageHeader title="Profile" description="Your account, photo and current shopping session." />

      <div className="mt-8 grid items-start gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section aria-label="Account" className="surface-card flex flex-col items-center p-6 text-center">
          <div className="relative">
            <span className="flex size-28 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-display text-3xl font-semibold text-primary ring-4 ring-surface shadow-card">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="Profile photo" className="size-full object-cover" />
              ) : isSignedIn && initials ? (
                initials
              ) : (
                <UserRound className="size-12" aria-hidden="true" />
              )}
            </span>
            <label className="absolute bottom-0.5 right-0.5 flex size-10 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-brand ring-4 ring-surface transition hover:bg-primary-hover focus-within:ring-primary/40">
              <Camera className="size-[1.125rem]" aria-hidden="true" />
              <span className="sr-only">Change profile photo</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => handleAvatarChange(event.target.files?.[0])}
              />
            </label>
          </div>

          <h2 className="mt-5 break-words text-xl font-semibold">{displayName}</h2>
          {emailLabel && <p className="mt-0.5 break-all text-sm text-ink-muted">{emailLabel}</p>}
          <div className="mt-3">
            <Badge tone={isSignedIn ? 'success' : 'neutral'} dot>
              {status === 'loading' ? 'Checking…' : isSignedIn ? 'Signed in' : 'Guest mode'}
            </Badge>
          </div>
          <p className="mt-4 text-xs leading-5 text-ink-subtle">Your photo is stored on this device only.</p>

          <div className="mt-6 w-full border-t border-line pt-5">
            <SignOutButton className="w-full" />
          </div>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="active-session-heading">
            <h2 id="active-session-heading" className="mb-3 text-base font-semibold">
              Current session
            </h2>
            {isCheckingActiveSession ? (
              <div className="surface-card flex items-center gap-4 p-5" aria-busy="true">
                <Skeleton className="size-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ) : activeSession ? (
              <Link
                href={`/session?sessionId=${encodeURIComponent(activeSession.sessionId)}`}
                className="group surface-card flex items-center gap-4 p-5 transition hover:border-brand-200 hover:shadow-raised"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ShoppingCart className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-ink">{activeSession.shoppingList.name}</p>
                    <Badge tone="success" pulse>
                      Live
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink-subtle">
                    On <span className="font-mono">{activeSession.cartCode}</span> · {activeSession.shoppingList.itemsCount} item
                    {activeSession.shoppingList.itemsCount === 1 ? '' : 's'}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </Link>
            ) : (
              <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-line-strong bg-surface p-5 sm:flex-row sm:items-center">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-subtle">
                  <ShoppingCart className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">No active cart session</p>
                  <p className="text-sm text-ink-subtle">Pick a list and scan a cart to start shopping.</p>
                </div>
                <ButtonLink href="/lists?activate=1" variant="outline" size="sm">
                  <ScanLine aria-hidden="true" />
                  Start shopping
                </ButtonLink>
              </div>
            )}
          </section>

          <section aria-labelledby="details-heading">
            <h2 id="details-heading" className="mb-3 text-base font-semibold">
              Account details
            </h2>
            <div className="surface-card px-5 py-4">
              <DescriptionList
                items={[
                  { label: 'Display name', value: displayName },
                  { label: 'Email', value: emailLabel || '—' },
                  { label: 'Account type', value: isSignedIn ? 'Carto account' : 'Guest' },
                ]}
              />
            </div>
          </section>

          <nav aria-label="Shortcuts" className="grid gap-3 sm:grid-cols-2">
            <Link href="/lists" className="group surface-card flex items-center gap-3 p-4 transition hover:border-brand-200">
              <ListChecks className="size-5 text-primary" aria-hidden="true" />
              <span className="flex-1 text-sm font-semibold text-ink">My lists</span>
              <ChevronRight className="size-4 text-ink-subtle" aria-hidden="true" />
            </Link>
            <Link href="/history" className="group surface-card flex items-center gap-3 p-4 transition hover:border-brand-200">
              <ReceiptText className="size-5 text-primary" aria-hidden="true" />
              <span className="flex-1 text-sm font-semibold text-ink">Receipts</span>
              <ChevronRight className="size-4 text-ink-subtle" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </div>
    </AppShell>
  );
}
