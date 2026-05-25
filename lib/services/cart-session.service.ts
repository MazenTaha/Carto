import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateTax } from '@/lib/utils';
import { ReceiptItem } from '@/types';
import { RequestOwner, ownerCreateData, ownerWhere } from '@/lib/guest-session';
import { ApiErrorResponse } from '../api-response';

type SessionWithReceipt = {
  id: string;
  cartId: string;
  userId: string | null;
  guestSessionId: string | null;
  status: string;
  endedAt: Date | null;
  cart: { storeId: string } | null;
  receipt: {
    id: string;
    status: string;
    lockedAt: Date | null;
    items: ReceiptItem[];
  } | null;
};

export class CartSessionService {
  private static async finalizeSession(
    tx: Prisma.TransactionClient,
    cartSession: SessionWithReceipt
  ) {
    const now = new Date();
    const alreadyFinished =
      cartSession.status === 'COMPLETED' ||
      cartSession.status === 'CHECKED_OUT' ||
      Boolean(cartSession.endedAt);

    if (!alreadyFinished) {
      await tx.cartSession.update({
        where: { id: cartSession.id },
        data: {
          status: 'COMPLETED',
          endedAt: now,
        },
      });
    }

    await tx.cart.updateMany({
      where: {
        id: cartSession.cartId,
      },
      data: {
        status: 'AVAILABLE',
        pairingCode: null,
        pairingExpiresAt: null,
        qrSessionId: null,
        lastSeen: now,
      },
    });

    let receiptId = cartSession.receipt?.id ?? null;

    if (cartSession.receipt) {
      const subtotal = cartSession.receipt.items.reduce(
        (sum: number, item: ReceiptItem) => sum + item.price * item.quantity,
        0
      );
      const tax = calculateTax(subtotal);
      const total = subtotal + tax;

      const receiptUpdate: Record<string, unknown> = {
        subtotal,
        tax,
        total,
      };

      if (cartSession.receipt.status === 'DRAFT') {
        receiptUpdate.status = 'LOCKED';
        receiptUpdate.lockedAt = cartSession.receipt.lockedAt ?? now;
      } else if (cartSession.receipt.status === 'LOCKED' && !cartSession.receipt.lockedAt) {
        receiptUpdate.lockedAt = now;
      }

      await tx.receipt.update({
        where: { id: cartSession.receipt.id },
        data: receiptUpdate,
      });
    } else {
      const ownerData = cartSession.userId
        ? ownerCreateData({ type: 'user', userId: cartSession.userId })
        : ownerCreateData({ type: 'guest', guestSessionId: cartSession.guestSessionId! });

      const receipt = await tx.receipt.create({
        data: {
          sessionId: cartSession.id,
          ...ownerData,
          cartId: cartSession.cartId,
          storeId: cartSession.cart?.storeId ?? null,
          status: 'LOCKED',
          lockedAt: now,
          subtotal: 0,
          tax: 0,
          total: 0,
        },
      });

      receiptId = receipt.id;
    }

    return {
      receiptId,
      status: alreadyFinished ? cartSession.status : 'COMPLETED',
      alreadyFinished,
    };
  }

  private static async getSession(where: Prisma.CartSessionWhereInput) {
    return prisma.cartSession.findFirst({
      where,
      include: {
        receipt: {
          include: { items: true },
        },
        cart: {
          select: { storeId: true },
        },
      },
    });
  }

  public static async finishSession(sessionId: string, owner: RequestOwner) {
    const cartSession = await this.getSession({
      id: sessionId,
      ...ownerWhere(owner),
    });

    if (!cartSession) {
      throw new ApiErrorResponse('Session not found', 404, 'NOT_FOUND');
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return this.finalizeSession(tx, cartSession);
    });
  }

  public static async forceFinishSession(sessionId: string) {
    const cartSession = await this.getSession({ id: sessionId });

    if (!cartSession) {
      throw new ApiErrorResponse('Session not found', 404, 'NOT_FOUND');
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return this.finalizeSession(tx, cartSession);
    });
  }
}
