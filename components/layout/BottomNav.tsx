'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();
  const navItems = [
    { label: 'Home', href: '/dashboard', icon: 'home' },
    { label: 'Lists', href: '/lists', icon: 'list_alt' },
    { label: 'History', href: '/history', icon: 'history' },
    { label: 'Profile', href: '/profile', icon: 'person' },
  ];
  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname?.startsWith(href);
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-warm-border/45 bg-white/92 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_28px_rgba(114,47,55,0.12)] backdrop-blur-xl dark:border-warm-border/45 dark:bg-white/92 md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition-all',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-500 hover:bg-primary/10 hover:text-primary dark:text-slate-500 dark:hover:bg-primary/10 dark:hover:text-primary'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className={cn('material-symbols-outlined text-[23px]', active && 'fill-1')}>{item.icon}</span>
              <span className="text-[11px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
