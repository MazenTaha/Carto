import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { RequestOwner, ownerCreateData, ownerWhere } from '@/lib/guest-session';
import { ApiErrorResponse } from '../api-response';

export interface LinkCartParams {
  cartCode: string;
  pairingCode: string;
  listId: string;
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
  /**
   * Links a user and their shopping list to a physical cart.
   * Handles security validation of the pairingCode and cart availability.
   * Returns the new (or reused) CartSession ID.
   */
  public static async linkCart(owner: RequestOwner, params: LinkCartParams) {
    const ownerFilter = ownerWhere(owner);
    const ownerData = ownerCreateData(owner);

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const now = new Date();

      // 1. Verify list ownership
      const list = await tx.shoppingList.findFirst({
        where: {
          id: params.listId,
          ...ownerFilter,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!list) {
        throw new ApiErrorResponse('List not found or you do not have access to it.', 403, 'FORBIDDEN');
      }

      // 2. Find and validate the physical cart
      const cart = await tx.cart.findUnique({
        where: { cartCode: params.cartCode },
        include: { store: true },
      });

      if (!cart) {
        throw new ApiErrorResponse('Cart not found. Please scan a valid Carto QR code.', 404, 'NOT_FOUND');
      }

      if (!cart.pairingCode || cart.pairingCode !== params.pairingCode) {
        throw new ApiErrorResponse('Cart pairing failed. Please scan the latest cart QR code.', 403, 'INVALID_CODE');
      }

      if (!cart.pairingExpiresAt || cart.pairingExpiresAt.getTime() <= now.getTime()) {
        throw new ApiErrorResponse('Cart pairing code expired. Please refresh the cart QR code.', 410, 'EXPIRED_CODE');
      }

      // 3. Check for existing active sessions on this cart
      const existingCartSession = await tx.cartSession.findFirst({
        where: { cartId: cart.id, status: 'ACTIVE', endedAt: null },
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
            cartCode: cart.cartCode,
            reused: true,
          };
        }

        throw new ApiErrorResponse('Cart is already in use by someone else.', 409, 'CART_IN_USE');
      }

      if (cart.status !== 'AVAILABLE') {
        const code = cart.status === 'IN_USE' ? 'CART_IN_USE' : 'CART_UNAVAILABLE';
        const status = cart.status === 'IN_USE' ? 409 : 400;
        throw new ApiErrorResponse(`Cart is currently ${cart.status.toLowerCase()}. Please try another cart.`, status, code);
      }

      // 4. Close any previous sessions for this user on other carts
      const previousOwnerSessions = await tx.cartSession.findMany({
        where: {
          ...ownerFilter,
          status: { in: ['ACTIVE', 'DISCONNECTED'] },
        },
        select: {
          id: true,
          cartId: true,
        },
      });

      if (previousOwnerSessions.length > 0) {
        await tx.cartSession.updateMany({
          where: {
            id: { in: previousOwnerSessions.map((activeSession) => activeSession.id) },
          },
          data: {
            status: 'COMPLETED',
            endedAt: new Date(),
          },
        });

        const previousCartIds = Array.from(
          new Set(previousOwnerSessions.map((activeSession) => activeSession.cartId).filter((cartId) => cartId !== cart.id))
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

      // 5. Claim the cart while it is still AVAILABLE. This keeps two phones
      // scanning the same QR from creating two active sessions.
      const claimedCart = await tx.cart.updateMany({
        where: {
          id: cart.id,
          status: 'AVAILABLE',
        },
        data: { status: 'IN_USE', lastSeen: now },
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
            cartCode: cart.cartCode,
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
        cartCode: cart.cartCode,
        reused: false,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }
}
