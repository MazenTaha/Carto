import { requireUserOrGuest } from '@/lib/guest-session';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getOwnedActiveCartSession } from '@/lib/active-cart-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const activeSession = await getOwnedActiveCartSession(owner);

    if (!activeSession) {
      return successResponse({ active: false });
    }

    return successResponse({
      active: true,
      session: activeSession,
    });
  } catch (error) {
    console.error('Error fetching current cart session:', error);
    return errorResponse('Failed to fetch current cart session', 500, 'INTERNAL_SERVER_ERROR');
  }
}
