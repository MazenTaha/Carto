import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { RequestOwner, ownerCreateData, ownerWhere } from '@/lib/guest-session';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';
import { buildCartCodeLookupWhere, normalizeCartCode } from '@/lib/cart-code';
import { buildCurrentCustomerCartSessionWhere } from '@/lib/current-cart-session';
import { ApiErrorResponse } from '../api-response';
import { CartConnectionService } from './cart-connection.service';
import { EMPTY_LIST_MESSAGE } from '@/lib/list-constants';

export interface LinkCartParams {
  cartCode: string;
  pairingCode: string;
  listId: string;
}

const PAIRING_TTL_MINUTES = 5;

function createPairingCode() {
  return String(randomInt(100000, 1000000));
}

function getPairingExpiresAt() {
  return new Date(Date.now() + PAIRING_TTL_MINUTES * 60 * 1000);
}

function sessionBelongsToOwner(
  cartSession: { userId: string | null; guestSessionId: string | null },
  owner: RequestOwner
) {
  return owner.type === 'user'
    ? cartSession.userId === owner.userId
    : cartSession.guestSessionId === owner.guestSessionId;
}

export class CartPairingService {
  private static async normalizeCartAvailability(
    tx: Prisma.TransactionClient,
    cart: { id: string; status: string }
  ) {
    if (cart.status !== 'IN_USE') {
      return cart.status;
    }

    const liveSession = await tx.cartSession.findFirst({
      where: {
        cartId: cart.id,
        status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
        endedAt: null,
      },
      select: { id: true },
    });

    if (liveSession) {
      return cart.status;
    }

    await tx.cart.update({
      where: { id: cart.id },
      data: { status: 'AVAILABLE', lastSeen: new Date() },
    });

    return 'AVAILABLE';
  }

  public static async generatePairingQr(cartCode: string) {
    await CartConnectionService.reconcileCartByCode(cartCode);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const cart = await tx.cart.findFirst({
        where: buildCartCodeLookupWhere(cartCode),
        select: {
          id: true,
          cartCode: true,
          status: true,
        },
      });

      if (!cart) {
        throw new ApiErrorResponse('Cart not found. Please use a valid Carto cart code.', 404, 'CART_NOT_FOUND');
      }

      const normalizedStatus = await this.normalizeCartAvailability(tx, cart);

      if (normalizedStatus === 'OFFLINE') {
        throw new ApiErrorResponse('Cart is offline and cannot accept pairing right now.', 409, 'CART_OFFLINE');
      }

      if (normalizedStatus === 'MAINTENANCE') {
        throw new ApiErrorResponse('Cart is in maintenance mode and cannot accept pairing right now.', 409, 'CART_MAINTENANCE');
      }

      if (normalizedStatus !== 'AVAILABLE') {
        throw new ApiErrorResponse('Cart is currently in use. Please try another cart.', 409, 'CART_IN_USE');
      }

      const pairingExpiresAt = getPairingExpiresAt();
      const updatedCart = await tx.cart.update({
        where: { id: cart.id },
        data: {
          pairingCode: createPairingCode(),
          pairingExpiresAt,
          qrSessionId: null,
          lastSeen: new Date(),
        },
        select: {
          cartCode: true,
          pairingCode: true,
          pairingExpiresAt: true,
        },
      });

      if (!updatedCart.pairingCode) {
        throw new ApiErrorResponse('Failed to generate a cart pairing code.', 500, 'PAIRING_CODE_MISSING');
      }

      const payload = {
        type: 'cart_pairing' as const,
        cartCode: normalizeCartCode(updatedCart.cartCode),
        pairingCode: updatedCart.pairingCode,
      };

      return {
        payload,
        qrValue: JSON.stringify(payload),
        expiresAt: updatedCart.pairingExpiresAt?.toISOString() ?? pairingExpiresAt.toISOString(),
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Links a user and their shopping list to a physical cart.
   * Handles security validation of the pairingCode and cart availability.
   * Returns the new (or reused) CartSession ID.
   */
  public static async linkCart(owner: RequestOwner, params: LinkCartParams) {
    const ownerFilter = ownerWhere(owner);
    const ownerData = ownerCreateData(owner);

    await CartConnectionService.reconcileCartByCode(params.cartCode);

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const now = new Date();

      // 1. Verify list ownership
      const list = await tx.shoppingList.findFirst({
        where: {
          id: params.listId,
          ...ownerFilter,
          deletedAt: null,
        },
        select: {
          id: true,
          _count: {
            select: {
              items: true,
            },
          },
        },
      });

      if (!list) {
        throw new ApiErrorResponse('List not found or you do not have access to it.', 403, 'FORBIDDEN');
      }

      if (list._count.items === 0) {
        throw new ApiErrorResponse(EMPTY_LIST_MESSAGE, 409, 'EMPTY_LIST');
      }

      // 2. Find and validate the physical cart
      const cart = await tx.cart.findFirst({
        where: buildCartCodeLookupWhere(params.cartCode),
        include: { store: true },
      });

      if (!cart) {
        throw new ApiErrorResponse('Cart not found. Please scan a valid Carto QR code.', 404, 'NOT_FOUND');
      }

      // 3. Check for existing active sessions on this cart
      const existingCartSession = await tx.cartSession.findFirst({
        where: {
          cartId: cart.id,
          status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
          endedAt: null,
        },
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
            cartCode: normalizeCartCode(cart.cartCode),
            reused: true,
          };
        }

        throw new ApiErrorResponse('Cart is already in use by someone else.', 409, 'CART_IN_USE');
      }

      const normalizedStatus = await this.normalizeCartAvailability(tx, cart);

      if (normalizedStatus === 'OFFLINE') {
        throw new ApiErrorResponse('Cart is offline and cannot accept pairing right now.', 409, 'CART_OFFLINE');
      }

      if (normalizedStatus === 'MAINTENANCE') {
        throw new ApiErrorResponse('Cart is in maintenance mode and cannot accept pairing right now.', 409, 'CART_MAINTENANCE');
      }

      if (normalizedStatus !== 'AVAILABLE') {
        throw new ApiErrorResponse(`Cart is currently ${normalizedStatus.toLowerCase()}. Please try another cart.`, 409, 'CART_IN_USE');
      }

      if (!cart.pairingCode || cart.pairingCode !== params.pairingCode) {
        throw new ApiErrorResponse('Invalid or expired cart pairing code.', 403, 'INVALID_PAIRING_CODE');
      }

      if (!cart.pairingExpiresAt || cart.pairingExpiresAt.getTime() <= now.getTime()) {
        throw new ApiErrorResponse('Invalid or expired cart pairing code.', 410, 'EXPIRED_PAIRING_CODE');
      }

      // 4. Block starting another live session while one is still active for this owner
      const previousOwnerSessions = await tx.cartSession.findMany({
        where: buildCurrentCustomerCartSessionWhere(ownerFilter),
        select: {
          id: true,
          cartId: true,
          listId: true,
        },
      });

      if (previousOwnerSessions.length > 0) {
        const otherOwnerSession = previousOwnerSessions.find(
          (activeSession) => activeSession.cartId !== cart.id || activeSession.listId !== list.id
        );

        if (otherOwnerSession) {
          throw new ApiErrorResponse(
            'You already have an active cart session.',
            409,
            'ACTIVE_SESSION_EXISTS'
          );
        }
      }

      // 5. Claim the cart while it is still AVAILABLE. This keeps two phones
      // scanning the same QR from creating two active sessions.
      const claimedCart = await tx.cart.updateMany({
        where: {
          id: cart.id,
          status: 'AVAILABLE',
          pairingCode: params.pairingCode,
          pairingExpiresAt: { gt: now },
        },
        data: {
          status: 'IN_USE',
          pairingCode: null,
          pairingExpiresAt: null,
          qrSessionId: null,
          lastSeen: now,
        },
      });

      if (claimedCart.count !== 1) {
        throw new ApiErrorResponse('Cart was just linked by another session. Please try another cart.', 409, 'CART_IN_USE');
      }

      // 6. Create the new session and draft receipt. The Raspberry Pi will
      // fetch this session separately through the active-session API.
      const createdSession = await tx.cartSession.create({
        data: {
          cartId: cart.id,
          ...ownerData,
          listId: list.id,
          status: 'ACTIVE',
          startedAt: now,
          qrCode: JSON.stringify({
            type: 'cart_pairing',
            cartCode: normalizeCartCode(cart.cartCode),
            pairingCode: params.pairingCode,
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

      // 7. Fire notification for registered users
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
        cartCode: normalizeCartCode(cart.cartCode),
        reused: false,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }
}
