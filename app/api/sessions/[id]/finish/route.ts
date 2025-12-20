// Finish shopping session API route

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { calculateTax } from '@/lib/utils';

// POST /api/sessions/[id]/finish - Finish shopping and lock receipt
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cartSession = await prisma.cartSession.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        receipt: {
          include: { items: true },
        },
      },
    });

    if (!cartSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update session status
    await prisma.cartSession.update({
      where: { id: params.id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });

    // Lock receipt if it exists
    if (cartSession.receipt) {
      const subtotal = cartSession.receipt.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const tax = calculateTax(subtotal);
      const total = subtotal + tax;

      await prisma.receipt.update({
        where: { id: cartSession.receipt.id },
        data: {
          status: 'LOCKED',
          lockedAt: new Date(),
          subtotal,
          tax,
          total,
        },
      });
    } else {
      // Create receipt if it doesn't exist
      const receipt = await prisma.receipt.create({
        data: {
          sessionId: params.id,
          userId: session.user.id,
          status: 'LOCKED',
          lockedAt: new Date(),
          subtotal: 0,
          tax: 0,
          total: 0,
        },
      });

      return NextResponse.json({
        success: true,
        data: { receiptId: receipt.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error finishing session:', error);
    return NextResponse.json(
      { error: 'Failed to finish session' },
      { status: 500 }
    );
  }
}

