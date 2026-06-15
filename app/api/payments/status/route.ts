import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireUserOrGuest } from '@/lib/guest-session';
import { centsToAmount } from '@/lib/payment-money';
import { PaymentService } from '@/lib/services/payment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getApiPaymentStatus(input: {
  attemptStatus: string;
  receiptStatus: string;
  receiptPaymentStatus: string;
}) {
  if (input.receiptStatus === 'PAID' || input.receiptPaymentStatus === 'COMPLETED' || input.attemptStatus === 'SUCCEEDED') {
    return 'PAID' as const;
  }

  if (input.receiptPaymentStatus === 'FAILED' || input.attemptStatus === 'FAILED') {
    return 'FAILED' as const;
  }

  if (input.attemptStatus === 'PROCESSING') {
    return 'PROCESSING' as const;
  }

  return 'PENDING' as const;
}

export async function GET(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const attemptId = request.nextUrl.searchParams.get('attemptId')?.trim() || null;
    const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim() || null;

    const attempt = attemptId
      ? await PaymentService.getOwnedAttempt(owner, attemptId)
      : await PaymentService.getLatestOwnedAttempt(owner, sessionId);

    if (!attempt || !attempt.receipt) {
      return errorResponse('Payment attempt not found.', 404, 'PAYMENT_ATTEMPT_NOT_FOUND');
    }

    return successResponse({
      paymentStatus: getApiPaymentStatus({
        attemptStatus: attempt.status,
        receiptStatus: attempt.receipt.status,
        receiptPaymentStatus: attempt.receipt.paymentStatus,
      }),
      receiptStatus: attempt.receipt.status,
      cartSessionStatus: attempt.cartSession?.status ?? null,
      amount: centsToAmount(attempt.amountCents),
      currency: attempt.currency,
      paidAt: attempt.receipt.paidAt?.toISOString() ?? attempt.completedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    return errorResponse('Failed to fetch payment status.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
