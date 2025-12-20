// Next.js middleware for route protection

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for guest mode cookie
  const guestMode = request.cookies.get('guest_mode');
  
  // If guest mode is active, allow access
  if (guestMode?.value === 'true') {
    return NextResponse.next();
  }
  
  // If NextAuth is not configured, allow access (for development)
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.next();
  }
  
  // Otherwise, use NextAuth middleware
  // Only import and use NextAuth if secret is configured
  try {
    const { withAuth } = require('next-auth/middleware');
    return withAuth(
      function middleware(req: NextRequest) {
        return NextResponse.next();
      },
      {
        callbacks: {
          authorized: ({ token }) => !!token,
        },
      }
    )(request);
  } catch (error) {
    // If NextAuth fails, allow access (for guest mode/development)
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/lists/:path*',
    '/session/:path*',
    '/checkout/:path*',
  ],
};

