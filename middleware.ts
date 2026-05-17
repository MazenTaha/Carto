import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isAdminEmail } from '@/lib/admin-emails';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || 'development-secret-change-in-production',
  });

  // ─── Admin routes ────────────────────────────────────────────────────────────
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

  // ─── Consumer app routes ─────────────────────────────────────────────────────
  if (token?.id) {
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
