import Link from 'next/link';
import {
  Activity,
  Banknote,
  ChevronRight,
  CircleCheck,
  Receipt,
  ShoppingCart,
  UserRoundPlus,
  Users,
  WifiOff,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/shared/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils';
import { StatsCard } from '@/components/admin/dashboard/StatsCard';
import { RecentSessionsTable } from '@/components/admin/dashboard/RecentSessionsTable';
import { ActivityFeed } from '@/components/admin/dashboard/ActivityFeed';
import { QuickActions } from '@/components/admin/dashboard/QuickActions';
import { getAdminOverviewData } from '@/lib/services/admin-dashboard.service';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const stats = await getAdminOverviewData();

  const cards = [
    { title: 'Active sessions', value: stats.activeSessions, icon: Activity, tone: 'success' as const },
    { title: "Today's revenue", value: formatCurrency(stats.todayRevenue), icon: Banknote },
    { title: 'Completed sessions', value: stats.completedSessions, icon: CircleCheck },
    { title: 'Receipts', value: stats.totalReceipts, icon: Receipt },
    { title: 'Total carts', value: stats.totalCarts, icon: ShoppingCart },
    { title: 'Carts offline', value: stats.cartsOffline, icon: WifiOff, tone: stats.cartsOffline > 0 ? ('danger' as const) : ('neutral' as const) },
    { title: 'Registered users', value: stats.totalUsers, icon: Users },
    { title: 'Guest sessions', value: stats.totalGuestSessions, icon: UserRoundPlus },
  ];

  const fleet = [
    { label: 'Available', value: stats.cartsAvailable, bar: 'bg-emerald-500' },
    { label: 'In use', value: stats.cartsInUse, bar: 'bg-primary' },
    { label: 'Maintenance', value: stats.cartsMaintenance, bar: 'bg-amber-500' },
    { label: 'Offline', value: stats.cartsOffline, bar: 'bg-red-500' },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" description="Live view of carts, sessions, receipts and shoppers." />

      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Key metrics
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {cards.map((card) => (
            <StatsCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section aria-labelledby="recent-sessions-heading" className="surface-card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-5 pb-1 pt-5">
            <h2 id="recent-sessions-heading" className="text-base font-semibold">
              Recent sessions
            </h2>
            <Link href="/admin/sessions" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <RecentSessionsTable sessions={stats.recentSessions} />
        </section>

        <section aria-labelledby="activity-heading" className="surface-card p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="activity-heading" className="text-base font-semibold">
              Activity
            </h2>
            <Badge tone="success" pulse>
              Live
            </Badge>
          </div>
          <ActivityFeed events={stats.activityFeed} />
        </section>
      </div>

      <section aria-labelledby="fleet-heading" className="surface-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="fleet-heading" className="text-base font-semibold">
            Cart fleet
          </h2>
          <p className="text-sm text-ink-subtle">
            {stats.totalCarts} cart{stats.totalCarts === 1 ? '' : 's'}
          </p>
        </div>
        <div
          className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-sunken"
          role="img"
          aria-label={fleet.map((f) => `${f.label}: ${f.value}`).join(', ')}
        >
          {fleet.map(({ label, value, bar }) =>
            value > 0 ? (
              <span key={label} className={`${bar} h-full border-r-2 border-surface last:border-r-0`} style={{ width: `${(value / Math.max(1, stats.totalCarts)) * 100}%` }} />
            ) : null
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fleet.map(({ label, value, bar }) => {
            const pct = stats.totalCarts > 0 ? Math.round((value / stats.totalCarts) * 100) : 0;
            return (
              <div key={label} className="rounded-xl bg-surface-muted px-3.5 py-3">
                <dt className="flex items-center gap-2 text-xs font-medium text-ink-muted">
                  <span className={`size-2 rounded-full ${bar}`} aria-hidden="true" />
                  {label}
                </dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <span className="tabular font-display text-xl font-semibold text-ink">{value}</span>
                  <span className="tabular text-xs text-ink-subtle">{pct}%</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="shortcuts-heading">
        <h2 id="shortcuts-heading" className="mb-3 text-base font-semibold">
          Manage
        </h2>
        <QuickActions />
      </section>
    </div>
  );
}
