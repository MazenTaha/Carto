import { NextRequest } from 'next/server';
import { requireUserOrGuest } from '@/lib/guest-session';
import { CartSessionService } from '@/lib/services/cart-session.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const result = await CartSessionService.finishSession(params.id, owner);

    return successResponse({
      sessionId: params.id,
      receiptId: result.receiptId,
      status: result.status,
      alreadyFinished: result.alreadyFinished,
    });
  } catch (error: any) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    
    console.error('Error finishing session:', error);
    return errorResponse('Failed to finish session', 500, 'INTERNAL_SERVER_ERROR');
  }
}
