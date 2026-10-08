'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CUSTOMER_NAV_ITEMS, isCustomerNavActive } from '@/lib/customer-nav';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe shadow-nav-top backdrop-blur-lg supports-[backdrop-filter]:bg-surface/85 lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-2 pt-1.5">
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
                  'group flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl text-2xs font-medium transition-colors',
                  active ? 'text-primary' : 'text-ink-subtle hover:text-ink'
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    active ? 'bg-brand-100' : 'group-hover:bg-surface-muted'
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.9} aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
