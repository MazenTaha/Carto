import { NextRequest } from 'next/server';
import { errorResponse, successResponse, ApiErrorResponse } from '@/lib/api-response';
import { requireUserOrGuest } from '@/lib/guest-session';
import { createPaymentSchema } from '@/lib/validations';
import { PaymentService } from '@/lib/services/payment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Request body must be valid JSON.', 400, 'INVALID_JSON');
    }

    const parsed = createPaymentSchema.parse(body);
    const checkout = await PaymentService.createHostedCheckout(owner, {
      sessionId: parsed.sessionId,
      receiptId: parsed.receiptId,
      paymentMethod: parsed.paymentMethod,
    });

    return successResponse({
      sessionId: checkout.sessionId,
      receiptId: checkout.receiptId,
      paymentAttemptId: checkout.attemptId,
      attemptId: checkout.attemptId,
      alreadyPaid: checkout.alreadyPaid,
      preview: checkout.preview,
      amount: checkout.amount,
      currency: checkout.currency,
      demoAmountFallback: checkout.demoAmountFallback,
      checkoutUrl: checkout.checkoutUrl,
      paymentUrl: checkout.checkoutUrl,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code, error.details);
    }

    console.error('Error creating Paymob checkout:', error);
    return errorResponse('Failed to create Paymob checkout.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
