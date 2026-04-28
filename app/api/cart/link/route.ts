// Cart linking API route - links a physical cart to a user's shopping list

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { linkCartSchema } from '@/lib/validations';

class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// POST /api/cart/link - Link a cart to a shopping list
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = linkCartSchema.parse(body);
    const userId = session.user.id;
    const publicCartId = validatedData.cartId || validatedData.cartCode;
    const isLegacyCartCodeOnly = !validatedData.cartId && Boolean(validatedData.cartCode) && !validatedData.pairingCode;

    if (!publicCartId) {
      return NextResponse.json({ error: 'Cart ID is required' }, { status: 400 });
    }

    if (!validatedData.pairingCode && !isLegacyCartCodeOnly) {
      return NextResponse.json({ error: 'Pairing code is required' }, { status: 400 });
    }

    const sessionData = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Verify list ownership before trusting any QR data.
      const list = await tx.shoppingList.findFirst({
        where: {
          id: validatedData.listId,
          userId,
        },
      });

      if (!list) {
        throw new ApiError('List not found or you do not have access to it.', 403);
      }

      let cart = await tx.cart.findUnique({
        where: { cartCode: publicCartId },
        include: { store: true },
      });

      if (!cart) {
        if (!validatedData.pairingCode) {
          throw new ApiError('Cart not found. Please scan a valid Carto QR code.', 404);
        }

        const store = await tx.store.findFirst({
          orderBy: { createdAt: 'asc' },
        }) || await tx.store.create({
          data: {
            name: 'Carto Store',
            location: 'Dynamic cart registration',
          },
        });

        cart = await tx.cart.create({
          data: {
            cartCode: publicCartId,
            bluetoothName: validatedData.bluetoothName || `Carto-${publicCartId}`,
            pairingCode: validatedData.pairingCode,
            qrSessionId: validatedData.sessionId,
            storeId: store.id,
            status: 'AVAILABLE',
            lastSeen: new Date(),
          },
          include: { store: true },
        });
      } else {
        if (cart.status === 'MAINTENANCE' || cart.status === 'OFFLINE') {
          throw new ApiError(`Cart is currently ${cart.status.toLowerCase()}. Please try another cart.`, 400);
        }

        if (cart.pairingCode && validatedData.pairingCode && cart.pairingCode !== validatedData.pairingCode) {
          throw new ApiError('Pairing code does not match this cart.', 400);
        }

        if (cart.pairingCode && !validatedData.pairingCode && !isLegacyCartCodeOnly) {
          throw new ApiError('Pairing code is required for this cart.', 400);
        }

        cart = await tx.cart.update({
          where: { id: cart.id },
          data: {
            bluetoothName: validatedData.bluetoothName || cart.bluetoothName,
            pairingCode: cart.pairingCode || validatedData.pairingCode,
            qrSessionId: validatedData.sessionId || cart.qrSessionId,
            lastSeen: new Date(),
          },
          include: { store: true },
        });
      }

      const existingCartSession = await tx.cartSession.findFirst({
        where: { cartId: cart.id, status: { in: ['ACTIVE', 'DISCONNECTED'] } },
      });

      if (existingCartSession && existingCartSession.userId !== userId) {
        throw new ApiError('Cart is already linked to another active session.', 409);
      }

      const existingUserSessions = await tx.cartSession.findMany({
        where: {
          userId,
          status: { in: ['ACTIVE', 'DISCONNECTED'] },
        },
        select: {
          id: true,
          cartId: true,
        },
      });

      if (existingUserSessions.length > 0) {
        await tx.cartSession.updateMany({
          where: {
            id: { in: existingUserSessions.map((activeSession) => activeSession.id) },
          },
          data: {
            status: 'COMPLETED',
            endedAt: new Date(),
          },
        });

        const previousCartIds = Array.from(
          new Set(existingUserSessions.map((activeSession) => activeSession.cartId).filter((cartId) => cartId !== cart.id))
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

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'IN_USE', lastSeen: new Date() },
      });

      const createdSession = await tx.cartSession.create({
        data: {
          cartId: cart.id,
          userId,
          listId: validatedData.listId,
          status: 'ACTIVE',
          qrCode: publicCartId,
          externalSessionId: validatedData.sessionId,
          receipt: {
            create: {
              userId,
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
        include: {
          shoppingList: {
            include: { items: true },
          },
          receipt: {
            include: { items: true },
          },
          cart: {
            include: { store: true },
          },
        },
      });

      await tx.notification.create({
        data: {
          userId,
          type: 'SESSION_STARTED',
          title: 'Shopping Session Started',
          message: `You started a shopping session at ${cart.store?.name || 'the store'}.`,
          data: { sessionId: createdSession.id, storeId: cart.storeId, cartCode: publicCartId },
        },
      });

      return createdSession;
    });

    const safeSessionData = {
      ...sessionData,
      cart: sessionData.cart ? { ...sessionData.cart, pairingCode: undefined } : sessionData.cart,
    };

    return NextResponse.json({ success: true, data: safeSessionData }, { status: 201 });
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
