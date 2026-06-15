import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isAdminEmail } from '@/lib/admin-emails';
import { getAuthSecret } from '@/lib/auth-secret';
import { GUEST_SESSION_COOKIE, LEGACY_GUEST_SESSION_COOKIES } from '@/lib/guest-session.constants';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
  });

  const hasGuestSession = [GUEST_SESSION_COOKIE, ...LEGACY_GUEST_SESSION_COOKIES].some((cookieName) =>
    Boolean(request.cookies.get(cookieName)?.value)
  );

  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  if (token?.id) {
    return NextResponse.next();
  }

  if (pathname === '/profile' || pathname.startsWith('/profile/')) {
    return NextResponse.next();
  }

  if (hasGuestSession) {
    return NextResponse.next();
  }

  const signInUrl = new URL('/auth/signin', request.url);
  signInUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/lists/:path*',
    '/session/:path*',
    '/checkout/:path*',
    '/profile/:path*',
    '/history/:path*',
  ],
};
