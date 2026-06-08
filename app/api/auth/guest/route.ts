import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import {
  clearGuestSessionCookie,
  clearLegacyGuestCookies,
  createGuestSession,
  getGuestSession,
  setGuestSessionCookie,
} from '@/lib/guest-session';
import { errorResponse, successResponse } from '@/lib/api-response';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.id) {
      return successResponse({
        guestSessionId: null,
        reused: false,
      });
    }

    const existingGuestSession = await getGuestSession();
    const guestSession = existingGuestSession ?? (await createGuestSession());

    const response = successResponse({
      guestSessionId: guestSession.id,
      reused: Boolean(existingGuestSession),
    });

    setGuestSessionCookie(response, guestSession.id);
    clearLegacyGuestCookies(response);

    return response;
  } catch (error) {
    console.error('Error creating guest session:', error);
    return errorResponse('Could not start guest mode.', 500, 'GUEST_SESSION_ERROR');
  }
}

export async function DELETE() {
  const response = successResponse({ cleared: true });
  clearGuestSessionCookie(response);
  clearLegacyGuestCookies(response);
  return response;
}
