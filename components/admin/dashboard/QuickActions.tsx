import Link from 'next/link';
import { Package, ShoppingCart, Activity, BarChart3, Users, ArrowRight } from 'lucide-react';

const ACTIONS = [
  { label: 'Manage Products',  href: '/admin/products',  icon: Package,      color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'View Carts',       href: '/admin/carts',     icon: ShoppingCart, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Live Sessions',    href: '/admin/sessions',  icon: Activity,     color: 'text-emerald-600',bg: 'bg-emerald-50' },
  { label: 'Analytics',        href: '/admin/analytics', icon: BarChart3,    color: 'text-blue-600',   bg: 'bg-blue-50' },
  { label: 'Users',            href: '/admin/users',     icon: Users,        color: 'text-amber-600',  bg: 'bg-amber-50' },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ACTIONS.map(({ label, href, icon: Icon, color, bg }) => (
        <Link
          key={href}
          href={href}
          className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-center transition-all hover:border-indigo-100 hover:shadow-md"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
            <Icon size={18} className={color} />
          </div>
          <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">
            {label}
          </span>
          <ArrowRight size={12} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400" />
        </Link>
      ))}
    </div>
  );
}
