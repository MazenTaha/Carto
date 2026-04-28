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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/90 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 md:hidden">
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
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
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
