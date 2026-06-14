'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Badge } from '@/components/ui/Badge';

const LOCAL_AVATAR_KEY = 'carto_profile_avatar';

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
  const [sessionMessage, setSessionMessage] = useState('');

  useEffect(() => {
    const savedAvatar = window.localStorage.getItem(LOCAL_AVATAR_KEY) || '';
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
        setSessionMessage('');
      } else {
        setActiveSession(null);
        setSessionMessage('No active cart session right now.');
      }
    } catch (error: any) {
      setActiveSession(null);
      setSessionMessage(error?.message || 'No active cart session right now.');
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
      window.localStorage.setItem(LOCAL_AVATAR_KEY, value);
    };
    reader.readAsDataURL(file);
  };

  const displayName = session?.user?.name?.trim() || session?.user?.email?.trim() || 'Guest shopper';
  const emailLabel = session?.user?.email?.trim() || 'Guest mode';
  const initials = useMemo(
    () => displayName
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
    [displayName]
  );

  const avatarDescription = status === 'authenticated'
    ? 'Profile photo preview is stored locally on this browser for now.'
    : 'Guest profile photo preview is stored locally on this browser.';

  return (
    <PageContainer maxWidth="lg">
      <Header title="Profile" showBack />

      <main className="grid flex-1 gap-6 pb-32 pt-6 md:grid-cols-[360px_1fr] md:pb-10">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="flex size-32 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-4xl font-black text-primary ring-4 ring-primary/10">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="Profile preview" className="h-full w-full object-cover" />
                ) : initials ? (
                  initials
                ) : (
                  <span className="material-symbols-outlined text-6xl">person</span>
                )}
              </div>
              <label className="absolute bottom-1 right-1 flex size-11 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform active:scale-95">
                <span className="material-symbols-outlined text-xl">photo_camera</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => handleAvatarChange(event.target.files?.[0])}
                />
              </label>
            </div>

            <Badge className="mt-5 bg-primary/10 text-primary ring-primary/10">
              {status === 'authenticated' ? 'Signed in' : 'Guest mode'}
            </Badge>
            <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">{displayName}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{emailLabel}</p>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
              {avatarDescription}
            </p>
            <label className="mt-5 inline-flex h-12 cursor-pointer items-center justify-center rounded-2xl bg-primary px-5 text-sm font-black text-white shadow-glow transition active:scale-[0.98]">
              Change photo
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => handleAvatarChange(event.target.files?.[0])}
              />
            </label>
          </div>
        </section>

        <section className="space-y-6">
          {activeSession ? (
            <Link
              href={`/session?sessionId=${encodeURIComponent(activeSession.sessionId)}`}
              className="block rounded-3xl border border-slate-200 bg-white p-6 shadow-card transition hover:border-primary/25 hover:shadow-soft dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <span className="material-symbols-outlined">sensors</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Active session</p>
                  <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-slate-100">View cart progress</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {activeSession.shoppingList.name} is connected to {activeSession.cartCode}. Open the live session whenever you are ready to continue.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                      {activeSession.shoppingList.itemsCount} item{activeSession.shoppingList.itemsCount === 1 ? '' : 's'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                      {activeSession.cartCode}
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-400">chevron_right</span>
              </div>
            </Link>
          ) : (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <span className="material-symbols-outlined">shopping_cart</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Active session</p>
                  <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-slate-100">
                    {isCheckingActiveSession ? 'Checking your cart session...' : 'No active cart session right now.'}
                  </h2>
                  {!isCheckingActiveSession && (
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {sessionMessage || 'Start shopping from your dashboard when you are ready to link a cart.'}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Profile details</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Display name</p>
                <p className="mt-2 text-base font-black text-slate-950 dark:text-slate-100">{displayName}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Mode</p>
                <p className="mt-2 text-base font-black text-slate-950 dark:text-slate-100">
                  {status === 'authenticated' ? 'Account profile' : 'Guest profile'}
                </p>
              </div>
            </div>
          </section>
        </section>
      </main>

      <BottomNav />
    </PageContainer>
  );
}
