// Cart linking API route - assigns a selected shopping list to a physical cart.

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { linkCartSchema } from '@/lib/validations';
import { ownerCreateData, ownerWhere, requireUserOrGuest, RequestOwner } from '@/lib/guest-session';

class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function sessionBelongsToOwner(
  cartSession: { userId: string | null; guestSessionId: string | null },
  owner: RequestOwner
) {
  return owner.type === 'user'
    ? cartSession.userId === owner.userId
    : cartSession.guestSessionId === owner.guestSessionId;
}

// POST /api/cart/link - Link a cart to a shopping list
export async function POST(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = linkCartSchema.parse(body);
    const ownerFilter = ownerWhere(owner);
    const ownerData = ownerCreateData(owner);

    const sessionData = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const list = await tx.shoppingList.findFirst({
        where: {
          id: validatedData.listId,
          ...ownerFilter,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!list) {
        throw new ApiError('List not found or you do not have access to it.', 403);
      }

      const cart = await tx.cart.findUnique({
        where: { cartCode: validatedData.cartCode },
        include: { store: true },
      });

      if (!cart) {
        throw new ApiError('Cart not found. Please scan a valid Carto QR code.', 404);
      }

      if (!cart.pairingCode || cart.pairingCode !== validatedData.pairingCode) {
        throw new ApiError('Cart pairing failed. Please scan the latest cart QR code.', 403);
      }

      if (cart.pairingExpiresAt && cart.pairingExpiresAt.getTime() < Date.now()) {
        throw new ApiError('Cart pairing code expired. Please refresh the cart QR code.', 410);
      }

      if (cart.status === 'MAINTENANCE' || cart.status === 'OFFLINE') {
        throw new ApiError(`Cart is currently ${cart.status.toLowerCase()}. Please try another cart.`, 400);
      }

      const existingCartSession = await tx.cartSession.findFirst({
        where: { cartId: cart.id, status: 'ACTIVE' },
        select: {
          id: true,
          listId: true,
          userId: true,
          guestSessionId: true,
        },
      });

      if (existingCartSession) {
        if (sessionBelongsToOwner(existingCartSession, owner) && existingCartSession.listId === list.id) {
          if (cart.status !== 'IN_USE') {
            await tx.cart.update({
              where: { id: cart.id },
              data: { status: 'IN_USE', lastSeen: new Date() },
            });
          }

          return {
            id: existingCartSession.id,
            cartCode: cart.cartCode,
            reused: true,
          };
        }

        throw new ApiError('Cart is already in use.', 409);
      }

      if (cart.status === 'IN_USE') {
        throw new ApiError('Cart is already in use.', 409);
      }

      const previousOwnerSessions = await tx.cartSession.findMany({
        where: {
          ...ownerFilter,
          status: { in: ['ACTIVE', 'DISCONNECTED'] },
        },
        select: {
          id: true,
          cartId: true,
        },
      });

      if (previousOwnerSessions.length > 0) {
        await tx.cartSession.updateMany({
          where: {
            id: { in: previousOwnerSessions.map((activeSession) => activeSession.id) },
          },
          data: {
            status: 'COMPLETED',
            endedAt: new Date(),
          },
        });

        const previousCartIds = Array.from(
          new Set(previousOwnerSessions.map((activeSession) => activeSession.cartId).filter((cartId) => cartId !== cart.id))
        );

        if (previousCartIds.length > 0) {
          await tx.cart.updateMany({
            where: {
              id: { in: previousCartIds },
              status: 'IN_USE',
            },
            data: {
              status: 'AVAILABLE',
              lastSeen: new Date(),
            },
          });
        }
      }

      const createdSession = await tx.cartSession.create({
        data: {
          cartId: cart.id,
          ...ownerData,
          listId: list.id,
          status: 'ACTIVE',
          startedAt: new Date(),
          qrCode: JSON.stringify({
            type: 'cart_pairing',
            cartCode: cart.cartCode,
            pairingCode: validatedData.pairingCode,
          }),
          receipt: {
            create: {
              ...ownerData,
              storeId: cart.storeId,
              cartId: cart.id,
              status: 'DRAFT',
              paymentMethod: 'CARD',
              paymentStatus: 'PENDING',
              subtotal: 0,
              tax: 0,
              total: 0,
            },
          },
        },
        select: {
          id: true,
        },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'IN_USE', lastSeen: new Date() },
      });

      if (owner.type === 'user') {
        await tx.notification.create({
          data: {
            userId: owner.userId,
            type: 'SESSION_STARTED',
            title: 'Shopping Session Started',
            message: `You started a shopping session at ${cart.store?.name || 'the store'}.`,
            data: { sessionId: createdSession.id, storeId: cart.storeId, cartCode: cart.cartCode },
          },
        });
      }

      return {
        id: createdSession.id,
        cartCode: cart.cartCode,
        reused: false,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: sessionData.id,
          sessionId: sessionData.id,
          cartCode: sessionData.cartCode,
          message: sessionData.reused ? 'Cart is already linked to this list' : 'Cart linked successfully',
        },
      },
      { status: sessionData.reused ? 200 : 201 }
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error('Error linking cart:', error);
    return NextResponse.json(
      { error: 'Failed to link cart' },
      { status: 500 }
    );
  }
}
