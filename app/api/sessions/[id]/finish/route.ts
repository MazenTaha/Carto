// Finish shopping session API route

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateTax } from '@/lib/utils';
import { ReceiptItem } from '@/types';
import { ownerCreateData, ownerWhere, requireUserOrGuest } from '@/lib/guest-session';

// POST /api/sessions/[id]/finish - Finish shopping and lock receipt
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cartSession = await prisma.cartSession.findFirst({
      where: {
        id: params.id,
        ...ownerWhere(owner),
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

    let receiptId = cartSession.receipt?.id;
    await prisma.$transaction(async (tx: any) => {
      await tx.cartSession.update({
        where: { id: params.id },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
        },
      });

      if (cartSession.cartId) {
        await tx.cart.update({
          where: { id: cartSession.cartId },
          data: { status: 'AVAILABLE', lastSeen: new Date() },
        });
      }

      if (cartSession.receipt) {
        const subtotal = cartSession.receipt.items.reduce(
          (sum: number, item: ReceiptItem) => sum + item.price * item.quantity,
          0
        );
        const tax = calculateTax(subtotal);
        const total = subtotal + tax;

        await tx.receipt.update({
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
        const receipt = await tx.receipt.create({
          data: {
            sessionId: params.id,
            ...ownerCreateData(owner),
            cartId: cartSession.cartId,
            status: 'LOCKED',
            lockedAt: new Date(),
            subtotal: 0,
            tax: 0,
            total: 0,
          },
        });

        receiptId = receipt.id;
      }
    });

    return NextResponse.json({ success: true, data: receiptId ? { receiptId } : undefined });
  } catch (error) {
    console.error('Error finishing session:', error);
    return NextResponse.json(
      { error: 'Failed to finish session' },
      { status: 500 }
    );
  }
}

