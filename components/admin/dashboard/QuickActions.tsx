import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ADMIN_NAV_ITEMS } from '@/components/admin/layout/admin-nav';

const DESCRIPTIONS: Record<string, string> = {
  '/admin/sessions': 'Monitor live carts',
  '/admin/carts': 'Fleet, QR and resets',
  '/admin/products': 'Catalog and prices',
  '/admin/users': 'Shopper accounts',
  '/admin/analytics': 'Trends and peak hours',
};

export function QuickActions() {
  const actions = ADMIN_NAV_ITEMS.filter((item) => item.href !== '/admin');

  return (
    <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {actions.map(({ label, href, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            className="group flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-xs transition hover:border-brand-200 hover:shadow-card"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-primary">
              <Icon className="size-[1.125rem]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{label}</span>
              <span className="block truncate text-xs text-ink-subtle">{DESCRIPTIONS[href]}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
