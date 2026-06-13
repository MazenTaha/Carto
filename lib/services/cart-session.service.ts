import { PaymentMethod, Prisma, SessionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateTax } from '@/lib/utils';
import { ReceiptItem } from '@/types';
import { RequestOwner, ownerCreateData, ownerWhere } from '@/lib/guest-session';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';
import { buildCartCodeLookupWhere, normalizeCartCode } from '@/lib/cart-code';
import { ApiErrorResponse } from '../api-response';

const DEFAULT_ACTIVE_SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

type TerminalSessionStatus = Extract<SessionStatus, 'COMPLETED' | 'CHECKED_OUT'>;

type FinalizeSessionOptions = {
  paymentId?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: 'COMPLETED';
  targetStatus?: TerminalSessionStatus;
};

type SessionWithReceipt = {
  id: string;
  cartId: string;
  userId: string | null;
  guestSessionId: string | null;
  status: SessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  cart: { storeId: string | null } | null;
  receipt: {
    id: string;
    status: string;
    lockedAt: Date | null;
    paymentId: string | null;
    paymentMethod: PaymentMethod;
    paymentStatus: string;
    items: ReceiptItem[];
  } | null;
};

function getActiveSessionTimeoutMs() {
  const raw = Number(process.env.CART_ACTIVE_SESSION_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ACTIVE_SESSION_TIMEOUT_MS;
}

export class CartSessionService {
  public static getActiveSessionTimeoutMs() {
    return getActiveSessionTimeoutMs();
  }

  public static isActiveStatus(status: string) {
    return ACTIVE_CART_SESSION_STATUSES.includes(status as (typeof ACTIVE_CART_SESSION_STATUSES)[number]);
  }

  public static isSessionExpired(session: { status: string; startedAt: Date; endedAt: Date | null }, now = Date.now()) {
    if (!this.isActiveStatus(session.status) || session.endedAt) {
      return false;
    }

    return now - session.startedAt.getTime() > getActiveSessionTimeoutMs();
  }

  private static async finalizeSession(
    tx: Prisma.TransactionClient,
    cartSession: SessionWithReceipt,
    options: FinalizeSessionOptions = {}
  ) {
    const now = new Date();
    const targetStatus = options.targetStatus ?? 'COMPLETED';
    const alreadyFinished =
      cartSession.status === 'COMPLETED' ||
      cartSession.status === 'CHECKED_OUT' ||
      Boolean(cartSession.endedAt);
    const shouldPromoteToCheckedOut =
      targetStatus === 'CHECKED_OUT' && cartSession.status !== 'CHECKED_OUT';

    const nextStatus = alreadyFinished && !shouldPromoteToCheckedOut ? cartSession.status : targetStatus;

    if (!alreadyFinished || shouldPromoteToCheckedOut) {
      await tx.cartSession.update({
        where: { id: cartSession.id },
        data: {
          status: targetStatus,
          endedAt: cartSession.endedAt ?? now,
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

      if (options.paymentId) {
        receiptUpdate.status = 'PAID';
        receiptUpdate.lockedAt = cartSession.receipt.lockedAt ?? now;
        receiptUpdate.paymentId = options.paymentId;
        receiptUpdate.paymentMethod = options.paymentMethod ?? cartSession.receipt.paymentMethod;
        receiptUpdate.paymentStatus = options.paymentStatus ?? 'COMPLETED';
      } else if (cartSession.receipt.status === 'DRAFT') {
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
          status: options.paymentId ? 'PAID' : 'LOCKED',
          lockedAt: now,
          paymentId: options.paymentId ?? null,
          paymentMethod: options.paymentMethod ?? 'CARD',
          paymentStatus: options.paymentStatus ?? (options.paymentId ? 'COMPLETED' : 'PENDING'),
          subtotal: 0,
          tax: 0,
          total: 0,
        },
      });

      receiptId = receipt.id;
    }

    return {
      receiptId,
      status: nextStatus,
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

  private static async finalizeSessionById(sessionId: string, options: FinalizeSessionOptions = {}) {
    const cartSession = await this.getSession({ id: sessionId });

    if (!cartSession) {
      throw new ApiErrorResponse('Session not found', 404, 'NOT_FOUND');
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return this.finalizeSession(tx, cartSession, options);
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
      return this.finalizeSession(tx, cartSession, { targetStatus: 'COMPLETED' });
    });
  }

  public static async disconnectOwnedSession(owner: RequestOwner, sessionId?: string | null) {
    const cartSession = await prisma.cartSession.findFirst({
      where: {
        ...(sessionId ? { id: sessionId } : {}),
        ...ownerWhere(owner),
        status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
        endedAt: null,
      },
      select: {
        id: true,
        cartId: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!cartSession) {
      throw new ApiErrorResponse('No active cart session found', 404, 'ACTIVE_SESSION_NOT_FOUND');
    }

    const result = await this.resetCartById(cartSession.cartId);

    return {
      disconnected: true as const,
      sessionId: cartSession.id,
      cartCode: result.cartCode,
      cartStatus: result.status,
    };
  }

  public static async forceFinishSession(sessionId: string) {
    return this.finalizeSessionById(sessionId, { targetStatus: 'COMPLETED' });
  }

  public static async completeCheckout(
    sessionId: string,
    options: {
      paymentId: string;
      paymentMethod?: PaymentMethod;
    }
  ) {
    return this.finalizeSessionById(sessionId, {
      targetStatus: 'CHECKED_OUT',
      paymentId: options.paymentId,
      paymentMethod: options.paymentMethod,
      paymentStatus: 'COMPLETED',
    });
  }

  public static async expireStaleSessions(cartId?: string) {
    const staleBefore = new Date(Date.now() - getActiveSessionTimeoutMs());
    const staleSessions = await prisma.cartSession.findMany({
      where: {
        ...(cartId ? { cartId } : {}),
        status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
        endedAt: null,
        startedAt: { lt: staleBefore },
      },
      select: { id: true },
    });

    for (const session of staleSessions) {
      await this.forceFinishSession(session.id);
    }

    return staleSessions.map((session) => session.id);
  }

  public static async resetCartById(cartId: string) {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      select: {
        id: true,
        cartCode: true,
        status: true,
      },
    });

    if (!cart) {
      throw new ApiErrorResponse('Cart not found.', 404, 'CART_NOT_FOUND');
    }

    const activeSession = await prisma.cartSession.findFirst({
      where: {
        cartId: cart.id,
        status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
        endedAt: null,
      },
      select: { id: true },
      orderBy: { startedAt: 'desc' },
    });

    let closedSessionId: string | null = null;

    if (activeSession) {
      await this.forceFinishSession(activeSession.id);
      closedSessionId = activeSession.id;
    } else if (cart.status !== 'AVAILABLE') {
      await prisma.cart.update({
        where: { id: cart.id },
        data: {
          status: 'AVAILABLE',
          pairingCode: null,
          pairingExpiresAt: null,
          qrSessionId: null,
          lastSeen: new Date(),
        },
      });
    }

    return {
      cartCode: normalizeCartCode(cart.cartCode),
      status: 'AVAILABLE' as const,
      closedSessionId,
    };
  }

  public static async resetCartByCode(cartCode: string) {
    const cart = await prisma.cart.findFirst({
      where: buildCartCodeLookupWhere(cartCode),
      select: { id: true },
    });

    if (!cart) {
      throw new ApiErrorResponse('Cart not found.', 404, 'CART_NOT_FOUND');
    }

    return this.resetCartById(cart.id);
  }
}
