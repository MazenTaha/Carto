import { NextRequest, NextResponse } from 'next/server';
import {
  clearLegacyGuestCookies,
  createGuestSession,
  setGuestSessionCookie,
} from '@/lib/guest-session';

async function startGuestSession(redirectTo = '/dashboard') {
  if (!process.env.DATABASE_URL) {
    return {
      error: NextResponse.json(
        { error: 'Database is required for guest mode.' },
        { status: 503 }
      ),
    };
  }

  const guestSession = await createGuestSession();

  return { guestSession, redirectTo };
}

export async function POST(request: NextRequest) {
  try {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/dashboard';
    const result = await startGuestSession(redirectTo);

    if (result.error) {
      return result.error;
    }

    const response = NextResponse.json({
      success: true,
      data: {
        guestSessionId: result.guestSession.id,
        redirectTo: result.redirectTo,
      },
    });

    setGuestSessionCookie(response, result.guestSession.id);
    clearLegacyGuestCookies(response);

    return response;
  } catch (error) {
    console.error('Guest session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to start guest session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/dashboard';
    const result = await startGuestSession(redirectTo);

    if (result.error) {
      return result.error;
    }

    const response = NextResponse.redirect(new URL(result.redirectTo, request.url));
    setGuestSessionCookie(response, result.guestSession.id);
    clearLegacyGuestCookies(response);

    return response;
  } catch (error) {
    console.error('Guest session creation error:', error);
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }
}
