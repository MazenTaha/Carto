import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse, successResponse, ApiErrorResponse } from '@/lib/api-response';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { validatePaymentQrToken } from '@/lib/payment-qr';
import { DevicePaymentService } from '@/lib/services/device-payment.service';
import { PaymentService } from '@/lib/services/payment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ParsedPaymentQr =
  | {
      sessionId: string;
      receiptId: string | null;
      paymentToken: string | null;
    }
  | {
      checkoutToken: string;
    }
  | {
      attemptId: string;
      paymentToken: string | null;
    }
  | { error: string };

function readPaymentParams(searchParams: URLSearchParams) {
  const sessionId = searchParams.get('sessionId')?.trim() || '';
  const receiptId = searchParams.get('receiptId')?.trim() || null;
  const paymentToken = searchParams.get('token')?.trim() || searchParams.get('paymentToken')?.trim() || null;

  if (!sessionId) {
    return { error: 'Payment QR code is missing the session ID.' } as const;
  }

  return {
    sessionId,
    receiptId,
    paymentToken,
  } as const;
}

function getAllowedOrigins(request: NextRequest) {
  const origins = new Set<string>([new URL(request.url).origin]);

  for (const raw of [
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ]) {
    if (!raw) continue;

    try {
      origins.add(new URL(raw).origin);
    } catch {}
  }

  return origins;
}

function parsePaymentQrValue(qrValue: string, request: NextRequest): ParsedPaymentQr {
  const trimmedValue = qrValue.trim();

  if (!trimmedValue) {
    return { error: 'Payment QR code is empty.' };
  }

  if (trimmedValue.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmedValue) as {
        type?: string;
        sessionId?: string;
        receiptId?: string | null;
        paymentToken?: string | null;
      };

      if (parsed.type !== 'carto_payment') {
        return { error: 'This QR code is not a Carto payment code.' };
      }

      if (!parsed.sessionId?.trim()) {
        return { error: 'Payment QR code is missing the session ID.' };
      }

      return {
        sessionId: parsed.sessionId.trim(),
        receiptId: parsed.receiptId?.trim() || null,
        paymentToken: parsed.paymentToken?.trim() || null,
      };
    } catch {
      return { error: 'This QR code is not valid Carto payment JSON.' };
    }
  }

  try {
    const parsedUrl = trimmedValue.startsWith('/')
      ? new URL(trimmedValue, request.url)
      : new URL(trimmedValue);

    if (!getAllowedOrigins(request).has(parsedUrl.origin)) {
      return { error: 'This payment QR code does not belong to this Carto app.' };
    }

    if (
      !['/checkout', '/checkout/scan', '/payment/scan', '/session/ready', '/payment/pending'].includes(parsedUrl.pathname) &&
      !parsedUrl.pathname.startsWith('/checkout/')
    ) {
      return { error: 'This QR code is not a valid Carto payment route.' };
    }

    if (parsedUrl.pathname === '/checkout/scan') {
      const checkoutToken = parsedUrl.searchParams.get('token')?.trim() || '';

      if (!checkoutToken) {
        return { error: 'This payment QR code is missing its secure token.' };
      }

      return {
        checkoutToken,
      };
    }

    if (parsedUrl.pathname.startsWith('/checkout/')) {
      const attemptId = parsedUrl.pathname.slice('/checkout/'.length).trim();
      const paymentToken = parsedUrl.searchParams.get('token')?.trim() || parsedUrl.searchParams.get('paymentToken')?.trim() || null;

      if (!attemptId) {
        return { error: 'This payment QR code is missing the checkout attempt ID.' };
      }

      return {
        attemptId,
        paymentToken,
      };
    }

    return readPaymentParams(parsedUrl.searchParams);
  } catch {
    return { error: 'This QR code is not a valid Carto payment link.' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const qrValue = typeof body?.qrValue === 'string' ? body.qrValue : '';
    const parsedQr = parsePaymentQrValue(qrValue, request);

    if ('error' in parsedQr) {
      return errorResponse(parsedQr.error, 400, 'INVALID_PAYMENT_QR');
    }

    if ('attemptId' in parsedQr) {
      if (!parsedQr.paymentToken) {
        return errorResponse('This payment QR code is missing its access token.', 400, 'INVALID_PAYMENT_QR_TOKEN');
      }

      const attempt = await DevicePaymentService.getPublicCheckoutAttempt(parsedQr.attemptId, parsedQr.paymentToken);

      if (!attempt) {
        return errorResponse('This payment QR code is not available anymore.', 404, 'PAYMENT_QR_NOT_FOUND');
      }

      return successResponse({
        sessionId: attempt.attempt.sessionId,
        receiptId: attempt.attempt.receiptId,
        checkoutUrl: `/checkout/${encodeURIComponent(parsedQr.attemptId)}?token=${encodeURIComponent(parsedQr.paymentToken)}`,
      });
    }

    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if ('checkoutToken' in parsedQr) {
      const attempt = await PaymentService.getOwnedAttemptByPaymentQrToken(owner, parsedQr.checkoutToken);

      return successResponse({
        sessionId: attempt.sessionId,
        receiptId: attempt.receiptId,
        checkoutUrl: `/checkout/${encodeURIComponent(attempt.id)}`,
      });
    }

    const cartSession = await prisma.cartSession.findFirst({
      where: {
        id: parsedQr.sessionId,
        ...ownerWhere(owner),
      },
      select: {
        id: true,
        status: true,
        endedAt: true,
        receipt: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!cartSession) {
      return errorResponse('This payment QR code is not available for your session.', 404, 'PAYMENT_QR_NOT_FOUND');
    }

    if (parsedQr.receiptId && cartSession.receipt?.id !== parsedQr.receiptId) {
      return errorResponse('This payment QR code does not match the current receipt.', 400, 'PAYMENT_QR_MISMATCH');
    }

    if (parsedQr.paymentToken && !validatePaymentQrToken({
      sessionId: cartSession.id,
      receiptId: parsedQr.receiptId ?? cartSession.receipt?.id ?? null,
    }, parsedQr.paymentToken)) {
      return errorResponse('Invalid payment QR token.', 400, 'INVALID_PAYMENT_QR_TOKEN');
    }

    if (!['ACTIVE', 'DISCONNECTED', 'COMPLETED', 'CHECKED_OUT'].includes(cartSession.status)) {
      return errorResponse('This session is not ready for checkout.', 409, 'SESSION_NOT_READY');
    }

    return successResponse({
      sessionId: cartSession.id,
      receiptId: cartSession.receipt?.id ?? null,
      checkoutUrl: cartSession.receipt?.status === 'PAID'
        ? `/payment/success?sessionId=${encodeURIComponent(cartSession.id)}`
        : `/session/ready?sessionId=${encodeURIComponent(cartSession.id)}`,
    });
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code, error.details);
    }

    console.error('Error validating payment QR:', error);
    return errorResponse('Failed to validate payment QR code.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
