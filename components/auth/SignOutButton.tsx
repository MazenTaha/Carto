'use client';

import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';

interface SignOutButtonProps {
  className?: string;
  variant?: 'outline' | 'ghost' | 'icon';
}

export function SignOutButton({ className, variant = 'outline' }: SignOutButtonProps) {
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.href = '/auth/signin';
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleSignOut}
        className={cn(
          "flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:text-slate-400",
          className
        )}
        aria-label="Sign out"
      >
        <span className="material-symbols-outlined">logout</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-red-900/20",
        className
      )}
    >
      <span className="material-symbols-outlined text-[20px]">logout</span>
      Sign Out
    </button>
  );
}
