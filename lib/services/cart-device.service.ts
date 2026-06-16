import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';
import { normalizeCartCode } from '@/lib/cart-code';
import { PAYMOB_CURRENCY } from '@/lib/payment-money';
import { normalizeBasePriceEGP } from '@/lib/pricing';
import { ApiErrorResponse } from '../api-response';
import { calculateTax } from '../utils';
import { CartSessionService } from './cart-session.service';
import { DevicePaymentService } from './device-payment.service';

const activeDeviceSessionSelect = {
  id: true,
  cartId: true,
  userId: true,
  guestSessionId: true,
  status: true,
  startedAt: true,
  endedAt: true,
  shoppingList: {
    select: {
      id: true,
      name: true,
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          price: true,
          category: true,
          isCollected: true,
          collectedAt: true,
          listId: true,
        },
        orderBy: { id: 'asc' as const },
      },
    },
  },
  receipt: {
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      subtotal: true,
      tax: true,
      total: true,
      lockedAt: true,
      paymentId: true,
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          price: true,
          category: true,
          scannedAt: true,
        },
        orderBy: { scannedAt: 'desc' as const },
      },
      paymentAttempts: {
        select: {
          id: true,
          status: true,
          amountCents: true,
          currency: true,
        },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    },
  },
} satisfies Prisma.CartSessionSelect;

type ActiveDeviceSession = Prisma.CartSessionGetPayload<{
  select: typeof activeDeviceSessionSelect;
}>;

type DeviceSessionSnapshot = {
  id: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  shoppingList: {
    id: string;
    name: string;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
      category: string | null;
      isCollected: boolean;
    }>;
  };
  receipt: {
    id: string;
    status: string;
    total: number;
    currency?: string;
    paymentStatus?: string | null;
    paymentAttempts?: Array<{
      id: string;
      status: string;
      amountCents?: number;
      currency?: string;
    }>;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
      category: string | null;
      scannedAt?: Date;
    }>;
  } | null;
};

function buildMutableReceiptError() {
  return new ApiErrorResponse(
    'The active receipt is already finalized and cannot be changed from the cart device.',
    409,
    'RECEIPT_FINALIZED'
  );
}

function ensureMutableReceipt(session: ActiveDeviceSession) {
  if (!session.receipt) {
    throw new ApiErrorResponse('No active receipt exists for this cart session.', 409, 'RECEIPT_NOT_FOUND');
  }

  if (session.receipt.status === 'LOCKED' || session.receipt.status === 'PAID' || session.receipt.status === 'CANCELLED') {
    throw buildMutableReceiptError();
  }

  return session.receipt;
}

async function findActiveSession(
  tx: Prisma.TransactionClient,
  cartId: string
) {
  return tx.cartSession.findFirst({
    where: {
      cartId,
      status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
      endedAt: null,
    },
    select: activeDeviceSessionSelect,
    orderBy: { startedAt: 'desc' },
  });
}

async function recalculateReceiptTotals(
  tx: Prisma.TransactionClient,
  receiptId: string
) {
  const items = await tx.receiptItem.findMany({
    where: { receiptId },
    select: {
      price: true,
      quantity: true,
    },
  });

  const subtotal = items.reduce((sum, item) => sum + normalizeBasePriceEGP(item.price) * item.quantity, 0);
  const tax = calculateTax(subtotal);
  const total = subtotal + tax;

  await tx.receipt.update({
    where: { id: receiptId },
    data: {
      subtotal,
      tax,
      total,
    },
  });

  return { subtotal, tax, total };
}

async function resolveReceiptItemIdentity(
  tx: Prisma.TransactionClient,
  input: {
    productId?: string;
    name?: string;
    category?: string;
    price?: number;
  }
) {
  const trimmedName = input.name?.trim();

  if (trimmedName) {
    return {
      name: trimmedName,
      category: input.category?.trim() || null,
      price: normalizeBasePriceEGP(input.price),
    };
  }

  if (!input.productId) {
    throw new ApiErrorResponse('Provide a productId or product name.', 400, 'VALIDATION_ERROR');
  }

  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: {
      name: true,
      category: true,
      price: true,
    },
  });

  if (!product) {
    throw new ApiErrorResponse('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  }

  return {
    name: product.name,
    category: input.category?.trim() || product.category || null,
    price: normalizeBasePriceEGP(input.price ?? product.price),
  };
}

export class CartDeviceService {
  public static async getActiveSession(cartId: string) {
    return prisma.cartSession.findFirst({
      where: {
        cartId,
        status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
        endedAt: null,
      },
      select: activeDeviceSessionSelect,
      orderBy: { startedAt: 'desc' },
    });
  }

  public static buildWaitingPayload(cart: { cartCode: string; status: string }) {
    const canonicalCartCode = normalizeCartCode(cart.cartCode);

    return {
      status: 'waiting' as const,
      active: false,
      cartCode: canonicalCartCode,
      cartStatus: cart.status,
      cart: {
        cartCode: canonicalCartCode,
        status: cart.status,
      },
    };
  }

  public static buildActivePayload(
    cart: { cartCode: string; status: string },
    session: DeviceSessionSnapshot
  ) {
    const canonicalCartCode = normalizeCartCode(cart.cartCode);
    const payment = DevicePaymentService.buildActiveSessionPaymentSummary({
      receipt: session.receipt,
    });
    const receipt = session.receipt
      ? {
          ...session.receipt,
          currency: PAYMOB_CURRENCY,
        }
      : null;

    return {
      status: 'active' as const,
      active: true,
      cartCode: canonicalCartCode,
      cartStatus: cart.status,
      cartSessionId: session.id,
      sessionId: session.id,
      receiptId: session.receipt?.id ?? null,
      shoppingList: {
        id: session.shoppingList.id,
        name: session.shoppingList.name,
        items: session.shoppingList.items.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          category: item.category,
          checked: item.isCollected,
        })),
      },
      cartItems: session.receipt?.items ?? [],
      total: receipt?.total ?? 0,
      paymentStatus: payment?.status ?? receipt?.paymentStatus ?? null,
      payment,
      cart: {
        cartCode: canonicalCartCode,
        status: cart.status,
      },
      session: {
        id: session.id,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      },
      list: session.shoppingList,
      receipt,
    };
  }

  public static async addReceiptItem(
    cartId: string,
    input: {
      productId?: string;
      name?: string;
      price?: number;
      quantity: number;
      category?: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const session = await findActiveSession(tx, cartId);

      if (!session) {
        throw new ApiErrorResponse('No active cart session is available for this cart.', 404, 'NO_ACTIVE_SESSION');
      }

      const receipt = ensureMutableReceipt(session);
      const resolvedItem = await resolveReceiptItemIdentity(tx, input);
      const existingItem = await tx.receiptItem.findFirst({
        where: {
          receiptId: receipt.id,
          name: {
            equals: resolvedItem.name,
            mode: 'insensitive',
          },
        },
      });

      if (existingItem) {
        await tx.receiptItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + input.quantity,
            price: resolvedItem.price,
            category: resolvedItem.category,
          },
        });
      } else {
        await tx.receiptItem.create({
          data: {
            receiptId: receipt.id,
            name: resolvedItem.name,
            quantity: input.quantity,
            price: resolvedItem.price,
            category: resolvedItem.category,
          },
        });
      }

      await recalculateReceiptTotals(tx, receipt.id);

      const refreshedSession = await findActiveSession(tx, cartId);
      if (!refreshedSession) {
        throw new ApiErrorResponse('Active cart session disappeared during update.', 409, 'SESSION_CONFLICT');
      }

      return refreshedSession;
    });
  }

  public static async removeReceiptItem(
    cartId: string,
    input: {
      productId?: string;
      name?: string;
      quantity: number;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const session = await findActiveSession(tx, cartId);

      if (!session) {
        throw new ApiErrorResponse('No active cart session is available for this cart.', 404, 'NO_ACTIVE_SESSION');
      }

      const receipt = ensureMutableReceipt(session);
      const resolvedItem = await resolveReceiptItemIdentity(tx, input);
      const existingItem = await tx.receiptItem.findFirst({
        where: {
          receiptId: receipt.id,
          name: {
            equals: resolvedItem.name,
            mode: 'insensitive',
          },
        },
      });

      if (!existingItem) {
        throw new ApiErrorResponse('Receipt item not found.', 404, 'RECEIPT_ITEM_NOT_FOUND');
      }

      if (input.quantity >= existingItem.quantity) {
        await tx.receiptItem.delete({
          where: { id: existingItem.id },
        });
      } else {
        await tx.receiptItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity - input.quantity,
          },
        });
      }

      await recalculateReceiptTotals(tx, receipt.id);

      const refreshedSession = await findActiveSession(tx, cartId);
      if (!refreshedSession) {
        throw new ApiErrorResponse('Active cart session disappeared during update.', 409, 'SESSION_CONFLICT');
      }

      return refreshedSession;
    });
  }

  public static async checkout(cartId: string) {
    const session = await this.getActiveSession(cartId);

    if (!session) {
      throw new ApiErrorResponse('No active cart session is available for this cart.', 404, 'NO_ACTIVE_SESSION');
    }

    const receipt = session.receipt;
    if (!receipt) {
      throw new ApiErrorResponse('No active receipt exists for this cart session.', 409, 'RECEIPT_NOT_FOUND');
    }

    const paymentId = receipt.paymentId || `pi_device_mock_${Date.now()}`;
    const checkout = await CartSessionService.completeCheckout(session.id, {
      paymentId,
      paymentMethod: receipt.paymentMethod,
    });

    const updatedReceipt = await prisma.receipt.findUnique({
      where: { id: receipt.id },
      include: {
        items: {
          orderBy: { scannedAt: 'desc' },
        },
      },
    });

    return {
      cartSessionId: session.id,
      receiptId: receipt.id,
      items: updatedReceipt?.items ?? [],
      subtotal: updatedReceipt?.subtotal ?? 0,
      tax: updatedReceipt?.tax ?? 0,
      total: updatedReceipt?.total ?? 0,
      paymentStatus: 'MOCK_PAID' as const,
      status: checkout.status,
    };
  }
}
