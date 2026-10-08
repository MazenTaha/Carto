'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';
import { ADMIN_NAV_ITEMS, isAdminNavActive } from './admin-nav';

interface AdminSidebarProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  /** Drawer mode renders full labels and no collapse control. */
  variant?: 'rail' | 'drawer';
}

export function AdminSidebar({ collapsed = false, onToggleCollapsed, onNavigate, variant = 'rail' }: AdminSidebarProps) {
  const pathname = usePathname();
  const isCollapsed = variant === 'rail' && collapsed;

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-line bg-surface transition-[width] duration-200',
        variant === 'rail' ? (isCollapsed ? 'w-[4.5rem]' : 'w-60') : 'w-72'
      )}
    >
      <div className={cn('flex h-16 shrink-0 items-center gap-2 border-b border-line px-4', isCollapsed && 'justify-center px-0')}>
        <Link href="/admin" onClick={onNavigate} className="flex items-center gap-2 rounded-lg" aria-label="Carto admin home">
          {isCollapsed ? (
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary font-display text-lg font-bold text-white">
              C
            </span>
          ) : (
            <>
              <Logo height={24} />
              <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-primary">
                Admin
              </span>
            </>
          )}
        </Link>
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isAdminNavActive(pathname, item);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={isCollapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    active ? 'bg-brand-50 text-primary' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                    isCollapsed && 'justify-center px-0'
                  )}
                >
                  <Icon className="size-[1.125rem] shrink-0" strokeWidth={active ? 2.25 : 1.9} aria-hidden="true" />
                  {isCollapsed ? <span className="sr-only">{item.label}</span> : item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn('space-y-1 border-t border-line p-3', isCollapsed && 'px-2')}>
        <Link
          href="/dashboard"
          onClick={onNavigate}
          title={isCollapsed ? 'Open shopper app' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink',
            isCollapsed && 'justify-center px-0'
          )}
        >
          <ExternalLink className="size-[1.125rem] shrink-0" aria-hidden="true" />
          {isCollapsed ? <span className="sr-only">Open shopper app</span> : 'Shopper app'}
        </Link>
        {variant === 'rail' && onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink',
              isCollapsed && 'justify-center px-0'
            )}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-[1.125rem]" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="size-[1.125rem]" aria-hidden="true" />
                Collapse
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
