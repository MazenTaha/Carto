import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isAdminEmail } from '@/lib/admin-emails';
import { getAuthSecret } from '@/lib/auth-secret';
import { GUEST_SESSION_COOKIE } from '@/lib/guest-session.constants';

const USER_ONLY_PATHS = ['/profile'];

function isUserOnlyPath(pathname: string) {
  return USER_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
  });

  const hasGuestSession = Boolean(request.cookies.get(GUEST_SESSION_COOKIE)?.value);

  if (pathname.startsWith('/admin')) {
    if (!token?.id) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      signInUrl.searchParams.set('error', 'SessionRequired');
      return NextResponse.redirect(signInUrl);
    }

    const email = (token.email as string | null | undefined) ?? null;
    if (!isAdminEmail(email)) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('error', 'AccessDenied');
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  }

  if (token?.id) {
    return NextResponse.next();
  }

  if (hasGuestSession && !isUserOnlyPath(pathname)) {
    return NextResponse.next();
  }

  if (hasGuestSession && isUserOnlyPath(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
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
