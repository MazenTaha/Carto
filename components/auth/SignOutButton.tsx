'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export async function signOutAndRedirect() {
  await signOut({ redirect: false });
  window.location.href = '/auth/signin';
}

interface SignOutButtonProps {
  className?: string;
  variant?: 'outline' | 'menu';
}

export function SignOutButton({ className, variant = 'outline' }: SignOutButtonProps) {
  if (variant === 'menu') {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={() => void signOutAndRedirect()}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-700 transition hover:bg-red-50',
          className
        )}
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void signOutAndRedirect()}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-700',
        className
      )}
    >
      <LogOut className="size-4" aria-hidden="true" />
      Sign out
    </button>
  );
}
