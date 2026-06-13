import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireUserOrGuest } from '@/lib/guest-session';
import { PaymentService } from '@/lib/services/payment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { attemptId: string } }
) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const attempt = await PaymentService.getOwnedAttempt(owner, params.attemptId);

    if (!attempt) {
      return errorResponse('Payment attempt not found.', 404, 'PAYMENT_ATTEMPT_NOT_FOUND');
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
      checkoutUrl: attempt.checkoutUrl,
      completedAt: attempt.completedAt,
      failedAt: attempt.failedAt,
      lastError: attempt.lastError,
    });
  } catch (error) {
    console.error('Error fetching payment attempt:', error);
    return errorResponse('Failed to fetch payment attempt.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
