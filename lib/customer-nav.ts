import { History, House, ListChecks, ShoppingCart, UserRound, type LucideIcon } from 'lucide-react';

export interface CustomerNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const CUSTOMER_NAV_ITEMS: CustomerNavItem[] = [
  { label: 'Home', href: '/dashboard', icon: House },
  { label: 'Lists', href: '/lists', icon: ListChecks },
  { label: 'Cart', href: '/session', icon: ShoppingCart },
  { label: 'History', href: '/history', icon: History },
  { label: 'Profile', href: '/profile', icon: UserRound },
];

export function isCustomerNavActive(pathname: string | null, href: string) {
  if (!pathname) {
    return false;
  }

  if (href === '/' || href === '/dashboard') {
    return pathname === '/' || pathname === '/dashboard';
  }

  if (href === '/history') {
    return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith('/receipts/');
  }

  if (href === '/session') {
    return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith('/checkout');
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
