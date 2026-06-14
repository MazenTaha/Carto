import { requireUserOrGuest } from '@/lib/guest-session';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getOwnedActiveCartSession } from '@/lib/active-cart-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

function withNoStoreHeaders<T extends Response>(response: T) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return response;
}

export async function GET() {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return withNoStoreHeaders(errorResponse('Unauthorized', 401, 'UNAUTHORIZED'));
    }

    const activeSession = await getOwnedActiveCartSession(owner);

    if (!activeSession) {
      return withNoStoreHeaders(successResponse({ active: false }));
    }

    return withNoStoreHeaders(successResponse({
      active: true,
      cartSessionId: activeSession.sessionId,
      receiptId: activeSession.receiptId,
      cartCode: activeSession.cartCode,
      cartStatus: activeSession.cartStatus,
      listName: activeSession.shoppingList.name,
      itemsCount: activeSession.shoppingList.itemsCount,
      status: activeSession.status,
      session: activeSession,
    }));
  } catch (error) {
    console.error('Error fetching current cart session:', error);
    return withNoStoreHeaders(errorResponse('Failed to fetch current cart session', 500, 'INTERNAL_SERVER_ERROR'));
  }
}
