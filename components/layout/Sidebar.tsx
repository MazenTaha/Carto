'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScanLine } from 'lucide-react';
import { CUSTOMER_NAV_ITEMS, isCustomerNavActive } from '@/lib/customer-nav';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 pb-5 pt-5 lg:flex">
      <Link href="/dashboard" aria-label="Carto home" className="mb-8 flex w-fit items-center rounded-lg px-2 py-1">
        <Logo height={30} priority />
      </Link>

      <nav aria-label="Primary" className="flex-1">
        <ul className="space-y-1">
          {CUSTOMER_NAV_ITEMS.map((item) => {
            const active = isCustomerNavActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    active ? 'bg-brand-50 text-primary' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                  )}
                >
                  <Icon className="size-[1.125rem]" strokeWidth={active ? 2.25 : 1.9} aria-hidden="true" />
                  {item.label === 'Cart' ? 'Shopping session' : item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Link
        href="/lists?activate=1"
        prefetch={false}
        className="group rounded-2xl bg-primary p-4 text-white shadow-brand transition hover:bg-primary-hover"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/15">
          <ScanLine className="size-5" aria-hidden="true" />
        </span>
        <span className="mt-3 block font-display text-base font-semibold">Start shopping</span>
        <span className="mt-0.5 block text-xs leading-5 text-white/75">Pick a list, then scan the QR on your cart.</span>
      </Link>
    </aside>
  );
}
