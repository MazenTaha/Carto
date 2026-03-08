// Cart linking API route - links a physical cart to a user's shopping list

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { linkCartSchema } from '@/lib/validations';

// POST /api/cart/link - Link a cart to a shopping list
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = linkCartSchema.parse(body);

    // Look up the physical cart by code
    const cart = await prisma.cart.findUnique({
      where: { cartCode: validatedData.cartCode },
      include: { store: true },
    });

    if (!cart) {
      return NextResponse.json(
        { error: 'Cart not found. Please scan a valid QR code.' },
        { status: 404 }
      );
    }

    if (cart.status !== 'AVAILABLE' && cart.status !== 'IN_USE') {
      return NextResponse.json(
        { error: `Cart is currently ${cart.status.toLowerCase()}. Please try another cart.` },
        { status: 400 }
      );
    }

    // Verify list ownership
    const list = await prisma.shoppingList.findFirst({
      where: {
        id: validatedData.listId,
        userId: session.user.id,
      },
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    // Check if there's an existing active session for this cart
    const existingCartSession = await prisma.cartSession.findFirst({
      where: { cartId: cart.id, status: 'ACTIVE' },
    });

    if (existingCartSession && existingCartSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Cart is already linked to another user session' },
        { status: 400 }
      );
    }

    // End any existing active sessions for this user
    await prisma.cartSession.updateMany({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });

    // Mark cart as IN_USE
    await prisma.cart.update({
      where: { id: cart.id },
      data: { status: 'IN_USE', lastSeen: new Date() },
    });

    // Create new cart session with store-aware receipt
    const sessionData = await prisma.cartSession.create({
      data: {
        cartId: cart.id,
        userId: session.user.id,
        listId: validatedData.listId,
        status: 'ACTIVE',
        qrCode: validatedData.cartCode,
        receipt: {
          create: {
            userId: session.user.id,
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

    // Create a notification for session start
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: 'SESSION_STARTED',
        title: 'Shopping Session Started',
        message: `You started a shopping session at ${cart.store?.name || 'the store'}.`,
        data: { sessionId: sessionData.id, storeId: cart.storeId },
      },
    });

    return NextResponse.json({ success: true, data: sessionData }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error linking cart:', error);
    return NextResponse.json(
      { error: 'Failed to link cart' },
      { status: 500 }
    );
  }
}
