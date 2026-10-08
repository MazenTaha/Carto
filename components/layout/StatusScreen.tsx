import Link from 'next/link';
import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

type StatusTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

const tones: Record<StatusTone, string> = {
  brand: 'bg-brand-50 text-primary ring-brand-100',
  success: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100',
  danger: 'bg-red-50 text-red-600 ring-red-100',
  neutral: 'bg-surface-muted text-ink-muted ring-line',
};

interface StatusScreenProps {
  icon: LucideIcon;
  tone?: StatusTone;
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  iconClassName?: string;
  size?: 'md' | 'lg';
}

/** Centered single-card screen used for payment results, empty routes, and recoverable errors. */
export function StatusScreen({
  icon: Icon,
  tone = 'brand',
  title,
  description,
  eyebrow,
  children,
  actions,
  iconClassName,
  size = 'md',
}: StatusScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-16 items-center justify-center px-4">
        <Link href="/dashboard" aria-label="Carto home" className="rounded-lg">
          <Logo height={26} priority />
        </Link>
      </header>
      <main id="main-content" className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:pt-0">
        <section
          className={cn(
            'w-full rounded-3xl border border-line bg-surface p-6 text-center shadow-card animate-rise-in sm:p-10',
            size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
          )}
        >
          <div className={cn('mx-auto flex size-16 items-center justify-center rounded-2xl ring-[6px]', tones[tone])}>
            <Icon className={cn('size-8', iconClassName)} aria-hidden="true" />
          </div>
          {eyebrow && <div className="mt-6 flex justify-center">{eyebrow}</div>}
          <h1 className={cn('text-2xl font-bold sm:text-[1.75rem]', eyebrow ? 'mt-3' : 'mt-6')}>{title}</h1>
          {description && <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-6 text-ink-muted">{description}</p>}
          {children && <div className="mt-6 text-left">{children}</div>}
          {actions && <div className="mt-8 grid gap-3 sm:grid-cols-2 [&>*:only-child]:sm:col-span-2">{actions}</div>}
        </section>
      </main>
    </div>
  );
}
