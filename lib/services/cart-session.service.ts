import { prisma } from '@/lib/prisma';
import { calculateTax } from '@/lib/utils';
import { ReceiptItem } from '@/types';
import { RequestOwner, ownerWhere, ownerCreateData } from '@/lib/guest-session';
import { ApiErrorResponse } from '../api-response';
import { Prisma } from '@prisma/client';

export class CartSessionService {
  /**
   * Finishes an active shopping session.
   * Marks session as COMPLETED, unlocks the physical Cart back to AVAILABLE,
   * and calculates/locks the final Receipt.
   */
  public static async finishSession(sessionId: string, owner: RequestOwner) {
    const cartSession = await prisma.cartSession.findFirst({
      where: {
        id: sessionId,
        ...ownerWhere(owner),
      },
      include: {
        receipt: {
          include: { items: true },
        },
      },
    });

    if (!cartSession) {
      throw new ApiErrorResponse('Session not found', 404, 'NOT_FOUND');
    }

    let receiptId = cartSession.receipt?.id;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // End the session
      await tx.cartSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
        },
      });

      // Release the cart for the next shopper
      if (cartSession.cartId) {
        await tx.cart.update({
          where: { id: cartSession.cartId },
          data: { status: 'AVAILABLE', lastSeen: new Date() },
        });
      }

      // Finalize the receipt totals
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
        // Fallback if no receipt was created (should not happen in normal flow)
        const receipt = await tx.receipt.create({
          data: {
            sessionId: sessionId,
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

    return { receiptId };
  }
}
