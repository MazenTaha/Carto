import {
  clearGuestSessionCookie,
  clearLegacyGuestCookies,
  createGuestSession,
  getAuthenticatedUserId,
  getGuestSession,
  setGuestSessionCookie,
} from '@/lib/guest-session';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const userId = await getAuthenticatedUserId();

    if (userId) {
      return successResponse({
        guestSessionId: null,
        reused: false,
        redirectTo: '/dashboard',
      });
    }

    const existingGuestSession = await getGuestSession();
    const guestSession = existingGuestSession ?? (await createGuestSession());

    const response = successResponse({
      guestSessionId: guestSession.id,
      reused: Boolean(existingGuestSession),
      redirectTo: '/dashboard',
    });

    setGuestSessionCookie(response, guestSession.id);
    clearLegacyGuestCookies(response);

    return response;
  } catch (error) {
    const databaseMessage = getPrismaConnectivityMessage(error);

    if (process.env.NODE_ENV === 'development') {
      console.error('Error creating guest session:', error);
    } else {
      console.error('Error creating guest session.');
    }

    if (databaseMessage) {
      logSafeDatabaseError('auth/guest POST', error);
      return errorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE');
    }

    return errorResponse('Could not start guest mode. Please try again.', 500, 'GUEST_SESSION_CREATE_FAILED');
  }
}

export async function DELETE() {
  const response = successResponse({ cleared: true });
  clearGuestSessionCookie(response);
  clearLegacyGuestCookies(response);
  return response;
}
