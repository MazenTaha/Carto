import { NextRequest, NextResponse } from 'next/server';
import { guardAdminApi } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import QRCode from 'qrcode';

const patchSchema = z.object({
  action: z.enum(['reset', 'set_status', 'assign_secret']),
  status: z.enum(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OFFLINE']).optional(),
  deviceSecret: z.string().min(1).max(100).optional(),
});

// GET /api/admin/carts/[cartId]
export async function GET(
  req: NextRequest,
  { params }: { params: { cartId: string } }
) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: params.cartId },
      include: {
        store: true,
        sessions: {
          orderBy: { startedAt: 'desc' },
          take: 20,
          include: {
            user: { select: { email: true, name: true } },
            shoppingList: { select: { name: true, items: { select: { id: true } } } },
            receipt: { select: { total: true, status: true } },
          },
        },
      },
    });

    if (!cart) {
      return NextResponse.json(
        { success: false, error: 'Cart not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: cart });
  } catch (error: any) {
    console.error('[admin/carts/[cartId] GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cart' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/carts/[cartId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { cartId: string } }
) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { action, status, deviceSecret } = parsed.data;

    if (action === 'reset') {
      // End all active sessions and mark cart as AVAILABLE
      await prisma.cartSession.updateMany({
        where: { cartId: params.cartId, status: 'ACTIVE' },
        data: { status: 'DISCONNECTED', endedAt: new Date() },
      });
      const cart = await prisma.cart.update({
        where: { id: params.cartId },
        data: {
          status: 'AVAILABLE',
          qrSessionId: null,
          pairingCode: null,
          pairingExpiresAt: null,
        },
      });
      return NextResponse.json({ success: true, data: cart });
    }

    if (action === 'set_status' && status) {
      const cart = await prisma.cart.update({
        where: { id: params.cartId },
        data: { status },
      });
      return NextResponse.json({ success: true, data: cart });
    }

    if (action === 'assign_secret' && deviceSecret) {
      const cart = await prisma.cart.update({
        where: { id: params.cartId },
        data: { deviceSecret },
      });
      return NextResponse.json({ success: true, data: cart });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action or missing parameters' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[admin/carts/[cartId] PATCH]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update cart' },
      { status: 500 }
    );
  }
}

// POST /api/admin/carts/[cartId] — generate QR
export async function POST(
  req: NextRequest,
  { params }: { params: { cartId: string } }
) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: params.cartId },
      select: { cartCode: true, pairingCode: true },
    });

    if (!cart) {
      return NextResponse.json(
        { success: false, error: 'Cart not found' },
        { status: 404 }
      );
    }

    // Generate a fresh pairing code
    const pairingCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    await prisma.cart.update({
      where: { id: params.cartId },
      data: { pairingCode, pairingExpiresAt: expiresAt },
    });

    const payload = JSON.stringify({
      type: 'cart_pairing',
      cartCode: cart.cartCode,
      pairingCode,
    });

    const qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
    });

    return NextResponse.json({
      success: true,
      data: { qrDataUrl, pairingCode, expiresAt: expiresAt.toISOString() },
    });
  } catch (error: any) {
    console.error('[admin/carts/[cartId] POST]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate QR' },
      { status: 500 }
    );
  }
}
