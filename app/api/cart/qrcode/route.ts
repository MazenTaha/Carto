// QR code generation API route for physical Carto cart pairing payloads.

import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';
import { cartQrPayloadSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

const PAIRING_TTL_MINUTES = 10;

function createPairingCode() {
  return String(randomInt(100000, 1000000));
}

function getPairingExpiresAt() {
  return new Date(Date.now() + PAIRING_TTL_MINUTES * 60 * 1000);
}

// GET /api/cart/qrcode?cartCode=CART-001
// Optional for demos: &pairingCode=123456
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cartCode = searchParams.get('cartCode')?.trim() || searchParams.get('cartId')?.trim();
    const requestedPairingCode = searchParams.get('pairingCode')?.trim();

    if (!cartCode) {
      return NextResponse.json({ error: 'Cart code is required' }, { status: 400 });
    }

    const cart = await prisma.cart.findUnique({
      where: { cartCode },
      select: {
        id: true,
        cartCode: true,
        status: true,
      },
    });

    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    if (cart.status === 'MAINTENANCE' || cart.status === 'OFFLINE') {
      return NextResponse.json(
        { error: `Cart is currently ${cart.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    const pairingCode = requestedPairingCode || createPairingCode();
    const pairingExpiresAt = getPairingExpiresAt();

    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        pairingCode,
        pairingExpiresAt,
        qrSessionId: null,
        lastSeen: new Date(),
      },
    });

    const payload = cartQrPayloadSchema.parse({
      type: 'cart_pairing',
      cartCode: cart.cartCode,
      pairingCode,
    });

    const qrData = JSON.stringify(payload);
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
    });

    return NextResponse.json({
      success: true,
      data: {
        qrCode: qrCodeDataUrl,
        qrData,
        payload,
        pairingExpiresAt,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid QR payload' },
        { status: 400 }
      );
    }

    console.error('Error generating cart QR code:', error);
    return NextResponse.json(
      { error: 'Failed to generate cart QR code' },
      { status: 500 }
    );
  }
}
