import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireUserOrGuest } from '@/lib/guest-session';
import { PaymentService } from '@/lib/services/payment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const attempt = await PaymentService.getLatestOwnedAttempt(owner, sessionId);

    if (!attempt) {
      return successResponse(null);
    }

    return successResponse({
      id: attempt.id,
      sessionId: attempt.sessionId,
      receiptId: attempt.receiptId,
      amountCents: attempt.amountCents,
      currency: attempt.currency,
      status: attempt.status,
      paymentStatus: attempt.receipt.paymentStatus,
      receiptStatus: attempt.receipt.status,
      completedAt: attempt.completedAt,
      failedAt: attempt.failedAt,
      lastError: attempt.lastError,
    });
  } catch (error) {
    console.error('Error fetching latest payment attempt:', error);
    return errorResponse('Failed to fetch latest payment attempt.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
