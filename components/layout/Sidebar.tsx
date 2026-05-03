'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { label: 'Lists', href: '/lists', icon: 'format_list_bulleted' },
  { label: 'Active Session', href: '/session', icon: 'shopping_cart_checkout' },
  { label: 'History', href: '/history', icon: 'receipt_long' },
  { label: 'Profile', href: '/profile', icon: 'person' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-warm-border/45 bg-white/82 p-4 backdrop-blur-xl dark:border-warm-border/45 dark:bg-white/82 md:flex md:flex-col">
      <Link href="/dashboard" aria-label="Go to Carto home" className="mb-6 flex items-center rounded-2xl p-2 transition hover:bg-primary/10 dark:hover:bg-primary/10">
        <Logo width={118} height={42} />
      </Link>

      <div className="mb-5 rounded-2xl border border-primary/15 bg-primary/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Retail mode</p>
        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-900">
          {session?.user?.name || session?.user?.email || 'Signed in'}
        </p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard' || pathname === '/'
            : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition',
                active
                  ? 'bg-primary text-white shadow-glow'
                  : 'text-slate-600 hover:bg-primary/10 hover:text-primary dark:text-slate-600 dark:hover:bg-primary/10 dark:hover:text-primary'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className={cn('material-symbols-outlined text-[22px]', active && 'fill-1')}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/lists?activate=1"
        className="mt-5 flex items-center justify-between rounded-3xl bg-primary p-4 text-white shadow-soft transition active:scale-[0.98] dark:bg-primary"
      >
        <span>
          <span className="block text-sm font-black">Start shopping</span>
          <span className="mt-1 block text-xs text-white/70">Activate a list and scan a cart</span>
        </span>
        <span className="material-symbols-outlined">arrow_forward</span>
      </Link>
    </aside>
  );
}
