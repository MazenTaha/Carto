'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { useSession } from 'next-auth/react';


interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  sticky?: boolean;
  className?: string;
  showLogo?: boolean;
}

export function Header({
  title,
  showBack = false,
  onBack,
  rightElement,
  sticky = true,
  className,
  showLogo = false,
}: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header
      className={cn(
        'z-40 -mx-4 flex items-center gap-3 border-b border-warm-border/45 bg-white/88 px-4 py-3 backdrop-blur-xl dark:border-warm-border/45 dark:bg-white/88 sm:mx-0 sm:rounded-b-2xl sm:px-5',
        sticky && 'sticky top-0',
        className
      )}
    >
      <div className="flex min-w-10 shrink-0 items-center gap-2">
        {showBack && (
          <button
            type="button"
            onClick={onBack || (() => window.history.back())}
            className="flex size-10 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:scale-95 dark:text-primary dark:hover:bg-primary/10"
            aria-label="Go back"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        {showLogo && (
          <Link href="/dashboard" aria-label="Go to Carto home" className="flex items-center rounded-xl transition hover:opacity-80">
            <Logo width={82} height={30} />
          </Link>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center">
        {title ? (
          <h2 className="truncate text-center text-base font-bold leading-tight text-slate-950 dark:text-slate-950 sm:text-lg">
            {title}
          </h2>
        ) : (
          <Link href="/dashboard" aria-label="Go to Carto home" className="flex items-center">
            <Logo width={92} height={34} />
          </Link>
        )}
      </div>
      <div className="flex min-w-10 items-center justify-end gap-2">
        {session && (
          <>
            <SignOutButton className="hidden sm:inline-flex" />
            <SignOutButton variant="icon" className="sm:hidden" />
          </>
        )}
        {rightElement}
      </div>
    </header>
  );
}
