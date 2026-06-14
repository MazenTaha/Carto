import { NextRequest } from 'next/server';
import { requireUserOrGuest } from '@/lib/guest-session';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { CartSessionService } from '@/lib/services/cart-session.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    let body: { sessionId?: string } = {};

    try {
      const rawBody = await request.text();
      if (rawBody.trim()) {
        body = JSON.parse(rawBody) as { sessionId?: string };
      }
    } catch {
      return errorResponse('Request body must be valid JSON.', 400, 'INVALID_JSON');
    }

    const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim()
      ? body.sessionId.trim()
      : null;

    const result = await CartSessionService.disconnectOwnedSession(owner, sessionId);

    return successResponse(result);
  } catch (error: any) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Error disconnecting current customer cart session:', error);
    return errorResponse('Failed to disconnect cart', 500, 'INTERNAL_SERVER_ERROR');
  }
}
