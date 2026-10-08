'use client';

import { format, parseISO } from 'date-fns';
import { Activity, Banknote, ChartColumn, CircleAlert, ShoppingBasket } from 'lucide-react';
import { ReactNode } from 'react';
import { ColumnChart } from '@/components/admin/analytics/ColumnChart';
import { StatsCard } from '@/components/admin/dashboard/StatsCard';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { CardSkeleton, ChartSkeleton } from '@/components/admin/shared/LoadingSkeleton';
import { PageHeader } from '@/components/admin/shared/PageHeader';
import { useAdminAnalytics } from '@/hooks/admin/useAdminAnalytics';
import { formatCurrency } from '@/lib/utils';

const CART_STATUS: Record<string, { label: string; dot: string }> = {
  AVAILABLE: { label: 'Available', dot: 'bg-emerald-500' },
  IN_USE: { label: 'In use', dot: 'bg-primary' },
  MAINTENANCE: { label: 'Maintenance', dot: 'bg-amber-500' },
  OFFLINE: { label: 'Offline', dot: 'bg-red-500' },
};

function formatDay(value: string) {
  try {
    return format(parseISO(value), 'd MMM');
  } catch {
    return value;
  }
}

function ChartCard({
  title,
  description,
  children,
  table,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  table: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-card p-5 ${className ?? ''}`} aria-label={title}>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>
      <div className="mt-4">{children}</div>
      <details className="group mt-3 border-t border-line pt-3">
        <summary className="cursor-pointer select-none text-xs font-medium text-ink-muted hover:text-ink">View as table</summary>
        <div className="custom-scrollbar mt-3 max-h-64 overflow-auto">{table}</div>
      </details>
    </section>
  );
}

function DataTableMini({ headers, rows }: { headers: [string, string]; rows: Array<[string, string]> }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-ink-subtle">
          <th scope="col" className="py-1.5 font-medium">{headers[0]}</th>
          <th scope="col" className="py-1.5 text-right font-medium">{headers[1]}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map(([a, b]) => (
          <tr key={a}>
            <td className="py-1.5 text-ink">{a}</td>
            <td className="tabular py-1.5 text-right text-ink-muted">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AnalyticsPage() {
  const { analytics, isLoading, error } = useAdminAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <PageHeader title="Analytics" description="Last 30 days of shopping activity." icon={ChartColumn} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <ChartSkeleton height={340} />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Last 30 days of shopping activity." icon={ChartColumn} />
        <div className="surface-card">
          <EmptyState
            tone="danger"
            icon={<CircleAlert />}
            title="Analytics are unavailable"
            description="The analytics endpoint did not respond. Make sure you are signed in with an admin account."
          />
        </div>
      </div>
    );
  }

  // The API only returns days that had sessions; fill the 30-day window so quiet days read as zero.
  const sessionsByDay = new Map(analytics.sessionsPerDay.map((point) => [point.date, point.sessions]));
  const dailySessions = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(Date.now() - (29 - index) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { date: day, sessions: sessionsByDay.get(day) ?? 0 };
  });
  const activeDays = analytics.sessionsPerDay.length;

  const totalCarts = analytics.cartUtilization.reduce((sum, item) => sum + item.value, 0);
  const busiestHour = analytics.peakHours.reduce((best, point) => (point.sessions > best.sessions ? point : best), {
    hour: '—',
    sessions: 0,
  });
  const hasSessions = analytics.totalSessions > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Last 30 days of shopping activity." icon={ChartColumn} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatsCard title="Sessions" value={analytics.totalSessions.toLocaleString()} icon={Activity} helper="Started in the last 30 days" />
        <StatsCard title="Revenue" value={formatCurrency(analytics.totalRevenue)} icon={Banknote} helper="Receipt totals, last 30 days" />
        <StatsCard title="Average basket" value={formatCurrency(analytics.avgBasketSize)} icon={ShoppingBasket} helper="Revenue per session" />
      </div>

      {!hasSessions ? (
        <div className="surface-card">
          <EmptyState
            icon={<ChartColumn />}
            title="No sessions in the last 30 days"
            description="Charts appear once shoppers start linking carts."
          />
        </div>
      ) : (
        <>
          <ChartCard
            title="Sessions per day"
            description={`${activeDays} of the last 30 days had sessions`}
            table={
              <DataTableMini
                headers={['Day', 'Sessions']}
                rows={dailySessions.map((d) => [formatDay(d.date), d.sessions.toLocaleString()])}
              />
            }
          >
            <ColumnChart
              data={dailySessions}
              xKey="date"
              yKey="sessions"
              valueLabel="Sessions"
              formatLabel={formatDay}
              tickInterval={6}
            />
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard
              title="Peak hours"
              description={busiestHour.sessions > 0 ? `Busiest at ${busiestHour.hour} (server time)` : 'Sessions by start hour'}
              table={
                <DataTableMini
                  headers={['Hour', 'Sessions']}
                  rows={analytics.peakHours.map((d) => [d.hour, d.sessions.toLocaleString()])}
                />
              }
            >
              <ColumnChart data={analytics.peakHours} xKey="hour" yKey="sessions" valueLabel="Sessions" tickInterval={5} height={240} />
            </ChartCard>

            <ChartCard
              title="Top scanned products"
              description="Units scanned onto receipts"
              table={
                <DataTableMini
                  headers={['Product', 'Units']}
                  rows={analytics.topProducts.map((d) => [d.name, d.scans.toLocaleString()])}
                />
              }
            >
              {analytics.topProducts.length === 0 ? (
                <p className="py-16 text-center text-sm text-ink-subtle">No items scanned yet.</p>
              ) : (
                <ColumnChart
                  data={analytics.topProducts}
                  xKey="name"
                  yKey="scans"
                  valueLabel="Units"
                  layout="vertical"
                  height={Math.max(160, analytics.topProducts.length * 30)}
                />
              )}
            </ChartCard>
          </div>
        </>
      )}

      <section className="surface-card p-5" aria-labelledby="cart-status-heading">
        <h2 id="cart-status-heading" className="text-base font-semibold">
          Cart status
        </h2>
        <p className="mt-0.5 text-sm text-ink-subtle">
          {totalCarts} cart{totalCarts === 1 ? '' : 's'} right now
        </p>
        <ul className="mt-4 space-y-3">
          {analytics.cartUtilization.map((item) => {
            const config = CART_STATUS[item.name] ?? { label: item.name, dot: 'bg-ink-subtle' };
            const pct = totalCarts > 0 ? (item.value / totalCarts) * 100 : 0;
            return (
              <li key={item.name} className="grid grid-cols-[8rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
                <span className="flex items-center gap-2 text-ink">
                  <span className={`size-2 rounded-full ${config.dot}`} aria-hidden="true" />
                  {config.label}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                  <span className={`block h-full rounded-full ${config.dot}`} style={{ width: `${pct}%` }} />
                </span>
                <span className="tabular text-right text-ink-muted">{item.value}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
