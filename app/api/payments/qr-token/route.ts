import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { createPaymentQrToken } from '@/lib/payment-qr';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const body = await request.json().catch(() => null) as { sessionId?: string; receiptId?: string } | null;
    const sessionId = body?.sessionId?.trim();
    const receiptId = body?.receiptId?.trim();

    if (!sessionId || !receiptId) {
      return errorResponse('sessionId and receiptId are required.', 400, 'VALIDATION_ERROR');
    }

    const cartSession = await prisma.cartSession.findFirst({
      where: {
        id: sessionId,
        ...ownerWhere(owner),
      },
      select: {
        id: true,
        receipt: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!cartSession || cartSession.receipt?.id !== receiptId) {
      return errorResponse('This session is not available for payment QR generation.', 404, 'PAYMENT_QR_NOT_FOUND');
    }

    const paymentToken = createPaymentQrToken({ sessionId, receiptId });

    return successResponse({
      type: 'carto_payment',
      sessionId,
      receiptId,
      paymentToken,
    });
  } catch (error) {
    console.error('Error creating payment QR token:', error);
    return errorResponse('Failed to create payment QR token.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
