'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronDown, UserRound } from 'lucide-react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { cn } from '@/lib/utils';

function getInitials(value: string) {
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Avatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  const initials = getInitials(name);

  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xs font-semibold text-primary ring-1 ring-brand-200',
        className
      )}
      aria-hidden="true"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-full object-cover" />
      ) : initials ? (
        initials
      ) : (
        <UserRound className="size-4" />
      )}
    </span>
  );
}

export const LOCAL_AVATAR_KEY = 'carto_profile_avatar';
export const AVATAR_CHANGED_EVENT = 'carto:avatar-changed';

function readLocalAvatar() {
  try {
    return window.localStorage.getItem(LOCAL_AVATAR_KEY) || null;
  } catch {
    return null;
  }
}

export function useDisplayIdentity() {
  const { data: session, status } = useSession();
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setLocalAvatar(readLocalAvatar());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(AVATAR_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(AVATAR_CHANGED_EVENT, sync);
    };
  }, []);

  const isSignedIn = status === 'authenticated' && Boolean(session?.user);
  const name = session?.user?.name?.trim() || session?.user?.email?.split('@')[0] || (isSignedIn ? 'Shopper' : 'Guest shopper');

  return {
    isSignedIn,
    isLoading: status === 'loading',
    name,
    email: session?.user?.email ?? null,
    image: localAvatar || session?.user?.image || null,
  };
}

export function UserMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const identity = useDisplayIdentity();

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-full p-1 transition hover:bg-surface-sunken/70 sm:pr-2"
      >
        <Avatar name={identity.isSignedIn ? identity.name : ''} image={identity.image} />
        <ChevronDown className="hidden size-4 text-ink-subtle sm:block" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-raised animate-rise-in"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={identity.isSignedIn ? identity.name : ''} image={identity.image} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{identity.name}</p>
              <p className="truncate text-xs text-ink-subtle">{identity.email || (identity.isSignedIn ? 'Signed in' : 'Guest mode')}</p>
            </div>
          </div>
          <div className="my-1 border-t border-line" />
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-muted"
          >
            <UserRound className="size-4 text-ink-subtle" aria-hidden="true" />
            Profile
          </Link>
          <SignOutButton variant="menu" />
        </div>
      )}
    </div>
  );
}
