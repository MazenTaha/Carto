// Get active session API route

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';

export const dynamic = 'force-dynamic';

// GET /api/sessions/active - Get user's active session
export async function GET(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cartSession = await prisma.cartSession.findFirst({
      where: {
        ...ownerWhere(owner),
        status: { in: ['ACTIVE', 'DISCONNECTED'] },
      },
      select: {
        id: true,
        cartId: true,
        userId: true,
        guestSessionId: true,
        listId: true,
        status: true,
        startedAt: true,
        endedAt: true,
        qrCode: true,
        externalSessionId: true,
        shoppingList: {
          select: {
            id: true,
            name: true,
            userId: true,
            guestSessionId: true,
            createdAt: true,
            updatedAt: true,
            items: {
              select: {
                id: true,
                name: true,
                quantity: true,
                price: true,
                category: true,
                isCollected: true,
                collectedAt: true,
                listId: true,
              },
            },
          },
        },
        receipt: {
          select: {
            id: true,
            sessionId: true,
            userId: true,
            guestSessionId: true,
            status: true,
            subtotal: true,
            tax: true,
            total: true,
            createdAt: true,
            lockedAt: true,
            paymentId: true,
            storeId: true,
            cartId: true,
            paymentMethod: true,
            paymentStatus: true,
            items: {
              select: {
                id: true,
                name: true,
                quantity: true,
                price: true,
                category: true,
                receiptId: true,
                scannedAt: true,
              },
              orderBy: { scannedAt: 'desc' },
            },
          },
        },
        cart: {
          select: {
            id: true,
            cartCode: true,
            bluetoothName: true,
            qrSessionId: true,
            storeId: true,
            status: true,
            lastSeen: true,
            createdAt: true,
            updatedAt: true,
            store: {
              select: {
                id: true,
                name: true,
                location: true,
                currency: true,
                taxRate: true,
                logo: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!cartSession) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        session: cartSession,
        receipt: cartSession.receipt,
      },
    });
  } catch (error) {
    console.error('Error fetching active session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active session' },
      { status: 500 }
    );
  }
}

