import { CartStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';
import { CartSessionService } from './cart-session.service';

type ReconciledCart = {
  id: string;
  cartCode: string;
  status: CartStatus;
  lastSeen: Date;
};

export class CartConnectionService {
  private static async loadCartByCode(cartCode: string) {
    return prisma.cart.findUnique({
      where: { cartCode: cartCode.trim() },
      select: {
        id: true,
        cartCode: true,
        status: true,
        lastSeen: true,
      },
    });
  }

  private static async loadActiveSession(cartId: string) {
    return prisma.cartSession.findFirst({
      where: {
        cartId,
        status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
        endedAt: null,
      },
      select: {
        id: true,
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  private static async normalizeCartState(cart: ReconciledCart, hasActiveSession: boolean) {
    if (hasActiveSession && cart.status === 'AVAILABLE') {
      return prisma.cart.update({
        where: { id: cart.id },
        data: {
          status: 'IN_USE',
          lastSeen: new Date(),
        },
        select: {
          id: true,
          cartCode: true,
          status: true,
          lastSeen: true,
        },
      });
    }

    if (!hasActiveSession && cart.status === 'IN_USE') {
      return prisma.cart.update({
        where: { id: cart.id },
        data: {
          status: 'AVAILABLE',
          pairingCode: null,
          pairingExpiresAt: null,
          qrSessionId: null,
          lastSeen: new Date(),
        },
        select: {
          id: true,
          cartCode: true,
          status: true,
          lastSeen: true,
        },
      });
    }

    return cart;
  }

  public static async reconcileCartById(cartId: string) {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      select: {
        id: true,
        cartCode: true,
        status: true,
        lastSeen: true,
      },
    });

    if (!cart) {
      return null;
    }

    const expiredSessionIds = await CartSessionService.expireStaleSessions(cart.id);
    const activeSession = await this.loadActiveSession(cart.id);
    const normalizedCart = await this.normalizeCartState(cart, Boolean(activeSession));

    return {
      cart: normalizedCart,
      activeSession,
      activeSessionClosed: expiredSessionIds.length > 0,
      expiredSessionIds,
    };
  }

  public static async reconcileCartByCode(cartCode: string) {
    const trimmedCartCode = cartCode.trim();
    if (!trimmedCartCode) {
      return null;
    }

    const cart = await this.loadCartByCode(trimmedCartCode);
    if (!cart) {
      return null;
    }

    return this.reconcileCartById(cart.id);
  }

  public static async reconcileFleetCarts() {
    const carts = await prisma.cart.findMany({
      select: { id: true },
    });

    for (const cart of carts) {
      await this.reconcileCartById(cart.id);
    }
  }
}
