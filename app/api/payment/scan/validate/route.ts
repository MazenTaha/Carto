import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { validatePaymentQrToken } from '@/lib/payment-qr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ParsedPaymentQr =
  | {
      sessionId: string;
      receiptId: string | null;
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

    if (!['/checkout', '/payment/scan'].includes(parsedUrl.pathname)) {
      return { error: 'This QR code is not a valid Carto payment route.' };
    }

    return readPaymentParams(parsedUrl.searchParams);
  } catch {
    return { error: 'This QR code is not a valid Carto payment link.' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const body = await request.json().catch(() => null);
    const qrValue = typeof body?.qrValue === 'string' ? body.qrValue : '';
    const parsedQr = parsePaymentQrValue(qrValue, request);

    if ('error' in parsedQr) {
      return errorResponse(parsedQr.error, 400, 'INVALID_PAYMENT_QR');
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
        ? `/checkout/success?sessionId=${encodeURIComponent(cartSession.id)}`
        : `/checkout?sessionId=${encodeURIComponent(cartSession.id)}`,
    });
  } catch (error) {
    console.error('Error validating payment QR:', error);
    return errorResponse('Failed to validate payment QR code.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
