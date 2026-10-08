'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronDown, ExternalLink, Menu } from 'lucide-react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { Avatar } from '@/components/layout/UserMenu';
import { Badge } from '@/components/ui/Badge';
import { getAdminPageTitle } from './admin-nav';

export function AdminTopNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const name = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? 'Admin';

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-lg sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="-ml-1 flex size-10 items-center justify-center rounded-xl text-ink transition hover:bg-surface-sunken/70 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        <span className="hidden text-ink-subtle sm:inline">Admin</span>
        <span className="hidden text-line-strong sm:inline" aria-hidden="true">
          /
        </span>
        <span className="truncate font-semibold text-ink" aria-current="page">
          {getAdminPageTitle(pathname)}
        </span>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <Badge tone="success" pulse className="hidden sm:inline-flex">
          Live data
        </Badge>

        <div ref={containerRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Account menu"
            className="flex items-center gap-2 rounded-full p-1 transition hover:bg-surface-sunken/70 sm:pr-2"
          >
            <Avatar name={name} image={session?.user?.image} />
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-ink sm:block">{name}</span>
            <ChevronDown className="hidden size-4 text-ink-subtle sm:block" aria-hidden="true" />
          </button>

          {open && (
            <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-raised animate-rise-in">
              <div className="px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-ink">{name}</p>
                <p className="truncate text-xs text-ink-subtle">{session?.user?.email ?? 'Not signed in'}</p>
              </div>
              <div className="my-1 border-t border-line" />
              <Link
                href="/dashboard"
                role="menuitem"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-muted"
              >
                <ExternalLink className="size-4 text-ink-subtle" aria-hidden="true" />
                Open shopper app
              </Link>
              <SignOutButton variant="menu" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
