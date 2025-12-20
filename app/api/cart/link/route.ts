// Cart linking API route - links a cart to a user's shopping list

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { linkCartSchema } from '@/lib/validations';
import { generateCartId } from '@/lib/utils';

// POST /api/cart/link - Link a cart to a shopping list
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = linkCartSchema.parse(body);

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
    const existingSession = await prisma.cartSession.findUnique({
      where: { cartId: validatedData.cartId },
    });

    if (existingSession && existingSession.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Cart is already linked to another session' },
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

    // Create new cart session
    const sessionData = await prisma.cartSession.create({
      data: {
        cartId: validatedData.cartId,
        userId: session.user.id,
        listId: validatedData.listId,
        status: 'ACTIVE',
        qrCode: validatedData.cartId, // Store cart ID as QR code data
        receipt: {
          create: {
            userId: session.user.id,
            status: 'DRAFT',
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

