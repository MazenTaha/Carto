'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { UserMenu } from '@/components/layout/UserMenu';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl';

const maxWidths: Record<MaxWidth, string> = {
  sm: 'max-w-xl',
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
};

interface AppShellProps {
  children: ReactNode;
  /** Title shown in the top bar. Pages still render their own `<h1>`. */
  title?: string;
  /** `true` goes back in history; a string links to that route. */
  back?: boolean | string;
  onBack?: () => void;
  actions?: ReactNode;
  /**
   * `app` shows primary navigation (sidebar on desktop, tab bar on mobile).
   * `focus` hides navigation for single-task flows such as cart linking and checkout.
   */
  variant?: 'app' | 'focus';
  maxWidth?: MaxWidth;
  /** Extra bottom padding for pages with their own sticky action bar on mobile. */
  bottomBar?: boolean;
  mainClassName?: string;
}

function BackButton({ back, onBack }: { back?: boolean | string; onBack?: () => void }) {
  const router = useRouter();
  const className =
    'flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-surface-sunken/70';

  if (typeof back === 'string' && !onBack) {
    return (
      <Link href={back} prefetch={false} aria-label="Go back" className={className}>
        <ArrowLeft className="size-5" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label="Go back"
      className={className}
      onClick={() => {
        if (onBack) {
          onBack();
        } else if (window.history.length > 1) {
          router.back();
        } else {
          router.push('/dashboard');
        }
      }}
    >
      <ArrowLeft className="size-5" aria-hidden="true" />
    </button>
  );
}

export function AppShell({
  children,
  title,
  back,
  onBack,
  actions,
  variant = 'app',
  maxWidth = 'xl',
  bottomBar = false,
  mainClassName,
}: AppShellProps) {
  const showNav = variant === 'app';
  const hasBack = Boolean(back || onBack);
  const [isScrolled, setIsScrolled] = useState(false);

  // The page renders its own large <h1>; the compact bar title only appears once that heading scrolls away.
  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 72);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <div className={cn('min-h-dvh', showNav && 'lg:pl-64')}>
      <a
        href="#main-content"
        className="sr-only z-[200] rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      {showNav && <Sidebar />}

      <header
        className={cn(
          'sticky top-0 z-30 border-b bg-canvas/90 backdrop-blur-lg transition-colors supports-[backdrop-filter]:bg-canvas/75',
          isScrolled ? 'border-line' : 'border-transparent'
        )}
      >
        <div className={cn('mx-auto flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8', maxWidths[maxWidth])}>
          {hasBack ? (
            <BackButton back={back} onBack={onBack} />
          ) : (
            <Link
              href="/dashboard"
              prefetch={false}
              aria-label="Carto home"
              className={cn('flex items-center rounded-lg py-1 pr-1', showNav && 'lg:hidden')}
            >
              <Logo height={26} priority />
            </Link>
          )}

          {title && (
            <p
              aria-hidden={!isScrolled}
              className={cn(
                'min-w-0 truncate font-display text-base font-semibold text-ink transition-all duration-200 sm:text-lg',
                hasBack ? 'ml-1' : 'ml-2 lg:ml-0',
                isScrolled ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
              )}
            >
              {title}
            </p>
          )}

          <div className="ml-auto flex items-center gap-2">
            {actions}
            {showNav ? (
              <UserMenu />
            ) : (
              <Link href="/dashboard" prefetch={false} aria-label="Carto home" className="hidden items-center sm:flex">
                <Logo height={24} />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className={cn(
          'mx-auto w-full px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8',
          maxWidths[maxWidth],
          showNav ? 'pb-28 lg:pb-12' : 'pb-12',
          bottomBar && 'pb-40 lg:pb-12',
          mainClassName
        )}
      >
        {children}
      </main>

      {showNav && <BottomNav />}
    </div>
  );
}

/** Sticky mobile action bar that docks above the tab bar (or the screen edge in focus flows). */
export function MobileActionBar({
  children,
  className,
  aboveNav = false,
}: {
  children: ReactNode;
  className?: string;
  aboveNav?: boolean;
}) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 shadow-nav-top backdrop-blur-lg lg:hidden',
        aboveNav ? 'bottom-[calc(3.75rem+max(0.75rem,env(safe-area-inset-bottom)))] pb-3' : 'bottom-0 pb-safe',
        className
      )}
    >
      <div className="mx-auto max-w-xl">{children}</div>
    </div>
  );
}
