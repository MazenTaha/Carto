// Individual session API routes

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';
import { errorResponse, successResponse } from '@/lib/api-response';
import { CartConnectionService } from '@/lib/services/cart-connection.service';

export const dynamic = 'force-dynamic';

// GET /api/sessions/[id] - Get a specific session
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    let cartSession = await prisma.cartSession.findFirst({
      where: {
        id: params.id,
        ...ownerWhere(owner),
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
    });

    if (
      cartSession?.cart?.cartCode &&
      ACTIVE_CART_SESSION_STATUSES.includes(cartSession.status as (typeof ACTIVE_CART_SESSION_STATUSES)[number]) &&
      !cartSession.endedAt
    ) {
      const reconciliation = await CartConnectionService.reconcileCartByCode(cartSession.cart.cartCode);

      if (reconciliation?.activeSessionClosed) {
        cartSession = await prisma.cartSession.findFirst({
          where: {
            id: params.id,
            ...ownerWhere(owner),
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
        });
      } else if (reconciliation) {
        cartSession = {
          ...cartSession,
          cart: {
            ...cartSession.cart,
            status: reconciliation.cart.status,
            lastSeen: reconciliation.cart.lastSeen,
          },
        };
      }
    }

    if (!cartSession) {
      return errorResponse('Session not found', 404, 'NOT_FOUND');
    }

    const response = successResponse({
      session: cartSession,
      receipt: cartSession.receipt,
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    return response;
  } catch (error) {
    console.error('Error fetching session:', error);
    return errorResponse('Failed to fetch session', 500, 'INTERNAL_SERVER_ERROR');
  }
}

