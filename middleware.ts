import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const GUEST_SESSION_COOKIE = 'guest_session_id';

const guestAllowedRoutes = [
  '/dashboard',
  '/lists',
  '/session',
  '/checkout',
  '/history',
];

function startsWithRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || 'development-secret-change-in-production',
  });

  if (token?.id) {
    return NextResponse.next();
  }

  const hasGuestCookie = Boolean(request.cookies.get(GUEST_SESSION_COOKIE)?.value);

  if (hasGuestCookie && guestAllowedRoutes.some((route) => startsWithRoute(request.nextUrl.pathname, route))) {
    return NextResponse.next();
  }

  const signInUrl = new URL('/auth/signin', request.url);
  signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/lists/:path*',
    '/session/:path*',
    '/checkout/:path*',
    '/profile/:path*',
    '/history/:path*',
  ],
};
