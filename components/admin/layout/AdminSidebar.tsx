'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Activity,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/admin',           label: 'Dashboard',  icon: LayoutDashboard, exact: true },
  { href: '/admin/products',  label: 'Products',   icon: Package },
  { href: '/admin/carts',     label: 'Carts',      icon: ShoppingCart },
  { href: '/admin/sessions',  label: 'Sessions',   icon: Activity },
  { href: '/admin/users',     label: 'Users',      icon: Users },
  { href: '/admin/analytics', label: 'Analytics',  icon: BarChart3 },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'relative flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-16 items-center border-b border-slate-100 px-4 gap-3',
        collapsed && 'justify-center px-0'
      )}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
          <Zap size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-sm font-bold text-slate-900">Carto</span>
            <span className="block text-[10px] font-medium uppercase tracking-widest text-slate-400">Admin</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                collapsed && 'justify-center px-0'
              )}
            >
              <Icon
                size={18}
                className={cn(
                  'shrink-0 transition-colors',
                  active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                )}
              />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm hover:text-slate-700"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Bottom */}
      {!collapsed && (
        <div className="border-t border-slate-100 p-3">
          <div className="rounded-lg bg-indigo-50 px-3 py-2">
            <p className="text-xs font-semibold text-indigo-700">Carto Admin v1.0</p>
            <p className="text-[10px] text-indigo-400 mt-0.5">Smart Retail Platform</p>
          </div>
        </div>
      )}
    </aside>
  );
}
