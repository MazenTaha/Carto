export function isCustomerNavActive(pathname: string | null, href: string) {
  if (!pathname) {
    return false;
  }

  if (href === '/' || href === '/dashboard') {
    return pathname === '/' || pathname === '/dashboard';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
