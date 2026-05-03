import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    const deviceSecret = getBearerToken(request);

    if (!deviceSecret) {
      return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
    }

    const cart = await prisma.cart.findUnique({
      where: { cartCode: params.cartCode },
      select: {
        id: true,
        cartCode: true,
        status: true,
        deviceSecret: true,
      },
    });

    if (!cart || !cart.deviceSecret || cart.deviceSecret !== deviceSecret) {
      return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
    }

    const activeSession = await prisma.cartSession.findFirst({
      where: {
        cartId: cart.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        status: true,
        shoppingList: {
          select: {
            id: true,
            name: true,
            items: {
              select: {
                id: true,
                name: true,
                quantity: true,
                price: true,
                category: true,
                isCollected: true,
              },
              orderBy: { id: 'asc' },
            },
          },
        },
        receipt: {
          select: {
            id: true,
            status: true,
            subtotal: true,
            tax: true,
            total: true,
            items: {
              select: {
                id: true,
                name: true,
                quantity: true,
                price: true,
                category: true,
                scannedAt: true,
              },
              orderBy: { scannedAt: 'desc' },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!activeSession) {
      return NextResponse.json({
        active: false,
        cartCode: cart.cartCode,
        status: cart.status,
      });
    }

    return NextResponse.json({
      active: true,
      sessionId: activeSession.id,
      status: activeSession.status,
      cartCode: cart.cartCode,
      list: activeSession.shoppingList,
      receipt: activeSession.receipt,
    });
  } catch (error) {
    console.error('Error fetching device active session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active session' },
      { status: 500 }
    );
  }
}
