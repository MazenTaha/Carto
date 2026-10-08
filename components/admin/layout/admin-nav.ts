import { Activity, ChartColumn, LayoutDashboard, Package, ShoppingCart, Users, type LucideIcon } from 'lucide-react';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/sessions', label: 'Sessions', icon: Activity },
  { href: '/admin/carts', label: 'Carts', icon: ShoppingCart },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: ChartColumn },
];

export function isAdminNavActive(pathname: string | null, item: AdminNavItem) {
  if (!pathname) return false;
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getAdminPageTitle(pathname: string | null) {
  const match = ADMIN_NAV_ITEMS.find((item) => isAdminNavActive(pathname, item));
  return match?.label ?? 'Admin';
}
