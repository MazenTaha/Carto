import { StatsCard } from '@/components/admin/dashboard/StatsCard';
import { RecentSessionsTable } from '@/components/admin/dashboard/RecentSessionsTable';
import { ActivityFeed } from '@/components/admin/dashboard/ActivityFeed';
import { QuickActions } from '@/components/admin/dashboard/QuickActions';
import { AdminStats } from '@/types/admin';
import {
  ShoppingCart, Users, Activity, DollarSign,
  Wifi, WifiOff, CheckCircle, Clock,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getStats(): Promise<AdminStats | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      cache: 'no-store',
      headers: { Cookie: '' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  const cards = [
    {
      title: 'Total Carts',
      value: stats?.totalCarts ?? 0,
      icon: ShoppingCart,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
    },
    {
      title: 'Active Sessions',
      value: stats?.activeSessions ?? 0,
      icon: Activity,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      trend: { value: 12, label: 'vs yesterday' },
    },
    {
      title: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
    },
    {
      title: "Today's Revenue",
      value: `$${(stats?.todayRevenue ?? 0).toFixed(2)}`,
      icon: DollarSign,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      trend: { value: 8, label: 'vs yesterday' },
    },
    {
      title: 'Carts Online',
      value: stats?.cartsOnline ?? 0,
      icon: Wifi,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
    },
    {
      title: 'Carts Offline',
      value: stats?.cartsOffline ?? 0,
      icon: WifiOff,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-50',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome to Carto Admin — here's what's happening right now.
        </p>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* KPI Cards */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((card) => (
            <StatsCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Sessions */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Sessions</h2>
            <a
              href="/admin/sessions"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all →
            </a>
          </div>
          <RecentSessionsTable sessions={stats?.recentSessions ?? []} />
        </div>

        {/* Activity Feed */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Activity</h2>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          </div>
          <ActivityFeed events={stats?.activityFeed ?? []} />
        </div>
      </div>

      {/* Cart status bar */}
      {stats && (
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Cart Fleet Status</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Available', value: stats.cartsAvailable, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
              { label: 'In Use',    value: stats.cartsInUse,     color: 'bg-indigo-500',  textColor: 'text-indigo-700' },
              { label: 'Offline',   value: stats.cartsOffline,   color: 'bg-red-400',     textColor: 'text-red-700' },
              { label: 'Maintenance',value: (stats as any).cartsMaintenance ?? 0, color: 'bg-amber-400', textColor: 'text-amber-700' },
            ].map(({ label, value, color, textColor }) => {
              const pct = stats.totalCarts > 0 ? Math.round((value / stats.totalCarts) * 100) : 0;
              return (
                <div key={label} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">{label}</span>
                    <span className={`text-lg font-bold ${textColor}`}>{value}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200">
                    <div
                      className={`h-1.5 rounded-full ${color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs text-slate-400">{pct}%</p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
