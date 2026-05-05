import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || 'development-secret-change-in-production',
  });

  if (token?.id) {
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
