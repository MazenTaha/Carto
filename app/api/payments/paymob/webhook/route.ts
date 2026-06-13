import { NextRequest } from 'next/server';
import { errorResponse, successResponse, ApiErrorResponse } from '@/lib/api-response';
import { PaymentService } from '@/lib/services/payment.service';
import { verifyPaymobHmac } from '@/lib/paymob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function extractPayload(rawBody: unknown) {
  if (!rawBody || typeof rawBody !== 'object') {
    return {
      transaction: null,
      hmac: null,
    };
  }

  const payload = rawBody as Record<string, any>;
  const transaction = payload.obj && typeof payload.obj === 'object'
    ? payload.obj
    : payload.transaction && typeof payload.transaction === 'object'
      ? payload.transaction
      : payload;

  return {
    transaction,
    hmac: typeof payload.hmac === 'string' ? payload.hmac : null,
  };
}

function parseWebhookBody(rawText: string) {
  if (!rawText.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch {
    const params = new URLSearchParams(rawText);
    const asObject = Object.fromEntries(params.entries()) as Record<string, string>;

    if (typeof asObject.obj === 'string') {
      try {
        asObject.obj = JSON.parse(asObject.obj);
      } catch {}
    }

    return asObject;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawText = await request.text();
    const rawPayload = parseWebhookBody(rawText);
    const extracted = extractPayload(rawPayload);
    const hmac = request.nextUrl.searchParams.get('hmac') || extracted.hmac;

    if (!extracted.transaction) {
      return errorResponse('Paymob webhook transaction payload is missing.', 400, 'INVALID_PAYMOB_WEBHOOK');
    }

    const hmacVerified = verifyPaymobHmac(extracted.transaction, hmac);
    const hmacRequired = Boolean(process.env.PAYMOB_HMAC_SECRET?.trim());

    if (hmacRequired && !hmacVerified) {
      return errorResponse('Invalid Paymob HMAC signature.', 401, 'INVALID_PAYMOB_HMAC');
    }

    const success = Boolean(extracted.transaction.success);
    const pending = Boolean(extracted.transaction.pending);

    if (success && !pending) {
      const result = await PaymentService.markPaymobPaymentSucceeded({
        hmacVerified,
        rawPayload,
        transaction: extracted.transaction,
      });

      return successResponse({
        received: true,
        status: 'SUCCEEDED',
        ...result,
      });
    }

    if (pending) {
      return successResponse({
        received: true,
        status: 'PENDING',
      });
    }

    await PaymentService.markPaymobPaymentFailed(
      {
        hmacVerified,
        rawPayload,
        transaction: extracted.transaction,
      },
      extracted.transaction?.txn_response_code || extracted.transaction?.data?.message || 'Payment failed or is still pending.'
    );

    return successResponse({
      received: true,
      status: 'FAILED',
    });
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Error handling Paymob webhook:', error);
    return errorResponse('Failed to process Paymob webhook.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
