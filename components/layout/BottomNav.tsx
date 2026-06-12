'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) {
    return false;
  }

  if (href === '/dashboard') {
    return pathname === '/' || pathname === '/dashboard';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  const navItems = [
    { label: 'Home', href: '/dashboard', icon: 'home' },
    { label: 'Lists', href: '/lists', icon: 'list_alt' },
    { label: 'History', href: '/history', icon: 'history' },
    { label: 'Profile', href: '/profile', icon: 'person' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] w-full max-w-full overflow-x-hidden border-t border-warm-border/45 bg-white/92 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_28px_rgba(114,47,55,0.12)] backdrop-blur-xl pointer-events-auto dark:border-warm-border/45 dark:bg-white/92 md:hidden">
      <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-1 px-1">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                'relative flex min-h-14 w-full touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition-all pointer-events-auto',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-500 hover:bg-primary/10 hover:text-primary dark:text-slate-500 dark:hover:bg-primary/10 dark:hover:text-primary'
              )}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              style={{ WebkitTapHighlightColor: 'transparent' }}
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
