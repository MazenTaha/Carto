import crypto from 'crypto';
import { PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiErrorResponse } from '@/lib/api-response';
import type { RequestOwner } from '@/lib/guest-session';
import { ownerWhere } from '@/lib/guest-session';
import { isActiveCartSessionStatus } from '@/lib/cart-session-status';
import { amountToCents, formatPaymentCurrency, PAYMOB_CURRENCY } from '@/lib/payment-money';
import {
  buildPaymobBillingData,
  buildPaymobHostedCheckoutUrl,
  createPaymobAuthToken,
  createPaymobOrder,
  createPaymobPaymentKey,
} from '@/lib/paymob';

const REUSABLE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

type CreateHostedCheckoutInput = {
  sessionId: string;
  receiptId?: string | null;
  paymentMethod?: PaymentMethod;
};

type PaymobWebhookInput = {
  hmacVerified: boolean;
  rawPayload: unknown;
  transaction: Record<string, any>;
};

function buildMerchantOrderId() {
  return `carto_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function getReceiptOwnerProfile(owner: RequestOwner) {
  if (owner.type !== 'user') {
    return {
      name: 'Guest Shopper',
      email: null,
      phoneNumber: null,
    };
  }

  return prisma.user.findUnique({
    where: { id: owner.userId },
    select: {
      name: true,
      email: true,
      phoneNumber: true,
    },
  });
}

async function loadOwnedSession(owner: RequestOwner, sessionId: string) {
  return prisma.cartSession.findFirst({
    where: {
      id: sessionId,
      ...ownerWhere(owner),
    },
    include: {
      receipt: {
        include: {
          items: {
            orderBy: { scannedAt: 'desc' },
          },
        },
      },
      cart: {
        include: {
          store: {
            select: {
              id: true,
              name: true,
              currency: true,
            },
          },
        },
      },
      shoppingList: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

async function prepareOwnedReceiptForCheckout(owner: RequestOwner, input: CreateHostedCheckoutInput) {
  let cartSession = await loadOwnedSession(owner, input.sessionId);

  if (!cartSession) {
    throw new ApiErrorResponse('Cart session not found.', 404, 'SESSION_NOT_FOUND');
  }

  if (input.receiptId && cartSession.receipt?.id !== input.receiptId) {
    throw new ApiErrorResponse('Receipt does not belong to this cart session.', 403, 'RECEIPT_SESSION_MISMATCH');
  }

  if (cartSession.receipt?.status === 'PAID') {
    return cartSession;
  }

  const needsLock =
    !cartSession.receipt ||
    cartSession.receipt.status === 'DRAFT' ||
    isActiveCartSessionStatus(cartSession.status);

  if (needsLock) {
    const { CartSessionService } = await import('@/lib/services/cart-session.service');
    await CartSessionService.finishSession(cartSession.id, owner);
    cartSession = await loadOwnedSession(owner, input.sessionId);
  }

  if (!cartSession?.receipt) {
    throw new ApiErrorResponse('Receipt is not ready for payment.', 409, 'RECEIPT_NOT_READY');
  }

  if (cartSession.receipt.status !== 'LOCKED' && cartSession.receipt.status !== 'PAID') {
    throw new ApiErrorResponse('Receipt is not ready for payment.', 409, 'RECEIPT_NOT_READY');
  }

  return cartSession;
}

function buildPaymobItems(receipt: { items: Array<{ name: string; price: number; quantity: number; category: string | null }> }) {
  return receipt.items.map((item) => ({
    name: item.name,
    amount_cents: amountToCents(item.price),
    description: item.category || item.name,
    quantity: item.quantity,
  }));
}

async function reuseRecentAttempt(receiptId: string) {
  const attempt = await prisma.paymentAttempt.findFirst({
    where: {
      receiptId,
      status: {
        in: ['PENDING', 'PROCESSING'],
      },
      checkoutUrl: {
        not: null,
      },
      createdAt: {
        gte: new Date(Date.now() - REUSABLE_ATTEMPT_WINDOW_MS),
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return attempt;
}

async function recordUserPurchaseArtifacts(input: {
  receiptId: string;
  sessionId: string;
  paymentId: string;
}) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: input.receiptId },
    select: {
      id: true,
      userId: true,
      total: true,
      items: {
        select: {
          name: true,
          quantity: true,
        },
      },
    },
  });

  if (!receipt?.userId) {
    return;
  }

  const currentStats = await prisma.userStats.findUnique({
    where: { userId: receipt.userId },
  });

  const newTotalOrders = (currentStats?.totalOrders || 0) + 1;
  const newTotalSpent = (currentStats?.totalSpent || 0) + receipt.total;
  const newAverage = newTotalSpent / newTotalOrders;

  await prisma.userStats.upsert({
    where: { userId: receipt.userId },
    update: {
      totalOrders: newTotalOrders,
      totalSpent: newTotalSpent,
      averageBasketValue: newAverage,
    },
    create: {
      userId: receipt.userId,
      totalOrders: 1,
      totalSpent: receipt.total,
      averageBasketValue: receipt.total,
    },
  });

  const purchasedNames = Array.from(new Set(receipt.items.map((item) => item.name.trim()).filter(Boolean)));
  const matchedProducts = purchasedNames.length > 0
    ? await prisma.product.findMany({
        where: {
          OR: purchasedNames.map((name) => ({
            name: { equals: name, mode: 'insensitive' as const },
          })),
        },
        select: { id: true, name: true },
      })
    : [];
  const productByName = new Map(matchedProducts.map((product) => [product.name.toLowerCase(), product]));

  await Promise.all(
    receipt.items.map((item) => {
      const product = productByName.get(item.name.toLowerCase());
      if (!product) return Promise.resolve();

      return prisma.userFavoriteProduct.upsert({
        where: {
          userId_productId: {
            userId: receipt.userId!,
            productId: product.id,
          },
        },
        update: {
          purchaseCount: { increment: item.quantity },
          lastPurchased: new Date(),
        },
        create: {
          userId: receipt.userId!,
          productId: product.id,
          purchaseCount: item.quantity,
        },
      });
    })
  );

  await prisma.notification.create({
    data: {
      userId: receipt.userId,
      type: 'PAYMENT_SUCCESS',
      title: 'Payment Successful',
      message: `Your payment of ${formatPaymentCurrency(receipt.total)} has been confirmed successfully.`,
      data: {
        receiptId: input.receiptId,
        sessionId: input.sessionId,
        paymentId: input.paymentId,
        total: receipt.total,
        currency: PAYMOB_CURRENCY,
      },
    },
  });
}

export class PaymentService {
  public static async createHostedCheckout(owner: RequestOwner, input: CreateHostedCheckoutInput) {
    const cartSession = await prepareOwnedReceiptForCheckout(owner, input);
    const receipt = cartSession.receipt;

    if (!receipt) {
      throw new ApiErrorResponse('Receipt is not ready for payment.', 409, 'RECEIPT_NOT_READY');
    }

    if (receipt.status === 'PAID' && receipt.paymentId) {
      return {
        alreadyPaid: true,
        sessionId: cartSession.id,
        receiptId: receipt.id,
        attemptId: null,
        checkoutUrl: null,
      };
    }

    const existingAttempt = await reuseRecentAttempt(receipt.id);
    if (existingAttempt?.checkoutUrl) {
      return {
        alreadyPaid: false,
        sessionId: cartSession.id,
        receiptId: receipt.id,
        attemptId: existingAttempt.id,
        checkoutUrl: existingAttempt.checkoutUrl,
      };
    }

    const amountCents = amountToCents(receipt.total);
    if (amountCents <= 0) {
      throw new ApiErrorResponse('Receipt total must be greater than zero before payment.', 400, 'INVALID_PAYMENT_AMOUNT');
    }

    const merchantOrderId = buildMerchantOrderId();
    const paymentAttempt = await prisma.paymentAttempt.create({
      data: {
        receiptId: receipt.id,
        sessionId: cartSession.id,
        userId: owner.type === 'user' ? owner.userId : null,
        guestSessionId: owner.type === 'guest' ? owner.guestSessionId : null,
        merchantOrderId,
        amountCents,
        currency: PAYMOB_CURRENCY,
        status: 'PENDING',
        metadata: {
          cartCode: cartSession.cart?.cartCode ?? null,
          storeId: cartSession.cart?.storeId ?? null,
          storeName: cartSession.cart?.store?.name ?? null,
          listId: cartSession.shoppingList?.id ?? null,
          listName: cartSession.shoppingList?.name ?? null,
          paymentMethod: input.paymentMethod ?? receipt.paymentMethod,
        },
      },
    });

    try {
      const profile = await getReceiptOwnerProfile(owner);
      const authToken = await createPaymobAuthToken();
      const order = await createPaymobOrder({
        authToken,
        merchantOrderId,
        amountCents,
        items: buildPaymobItems(receipt),
      });
      const paymentKey = await createPaymobPaymentKey({
        authToken,
        orderId: order.id,
        amountCents,
        billingData: buildPaymobBillingData(profile ?? {}),
      });
      const checkoutUrl = buildPaymobHostedCheckoutUrl(paymentKey);

      await prisma.$transaction([
        prisma.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            providerOrderId: String(order.id),
            checkoutUrl,
            status: 'PROCESSING',
            rawResponse: {
              order,
            },
          },
        }),
        prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            paymentMethod: input.paymentMethod ?? receipt.paymentMethod,
            paymentStatus: 'PROCESSING',
          },
        }),
      ]);

      return {
        alreadyPaid: false,
        sessionId: cartSession.id,
        receiptId: receipt.id,
        attemptId: paymentAttempt.id,
        checkoutUrl,
      };
    } catch (error: any) {
      await prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          lastError: error?.message || 'Could not initialize Paymob checkout.',
        },
      });

      throw error;
    }
  }

  public static async getOwnedAttempt(owner: RequestOwner, attemptId: string) {
    return prisma.paymentAttempt.findFirst({
      where: {
        id: attemptId,
        ...ownerWhere(owner),
      },
      include: {
        receipt: {
          select: {
            id: true,
            total: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
    });
  }

  public static async getLatestOwnedAttempt(owner: RequestOwner, sessionId?: string | null) {
    return prisma.paymentAttempt.findFirst({
      where: {
        ...ownerWhere(owner),
        ...(sessionId ? { sessionId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        receipt: {
          select: {
            id: true,
            total: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
    });
  }

  public static async markPaymobPaymentSucceeded(input: PaymobWebhookInput) {
    const providerOrderId = input.transaction?.order?.id ? String(input.transaction.order.id) : null;
    const merchantOrderId = input.transaction?.order?.merchant_order_id
      ? String(input.transaction.order.merchant_order_id)
      : null;
    const lookup = [
      ...(providerOrderId ? [{ providerOrderId }] : []),
      ...(merchantOrderId ? [{ merchantOrderId }] : []),
    ];

    if (lookup.length === 0) {
      throw new ApiErrorResponse('Paymob webhook is missing order identifiers.', 400, 'INVALID_PAYMOB_WEBHOOK');
    }

    const paymentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        OR: lookup,
      },
    });

    if (!paymentAttempt) {
      throw new ApiErrorResponse('Payment attempt not found for this Paymob webhook.', 404, 'PAYMENT_ATTEMPT_NOT_FOUND');
    }

    const paymentId = String(
      input.transaction?.id ||
      paymentAttempt.providerTransactionId ||
      paymentAttempt.providerOrderId ||
      paymentAttempt.merchantOrderId
    );
    const wasAlreadySucceeded = paymentAttempt.status === 'SUCCEEDED';

    await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findUnique({
        where: { id: paymentAttempt.receiptId },
        include: {
          items: true,
        },
      });

      if (!receipt) {
        throw new ApiErrorResponse('Receipt not found for this payment attempt.', 404, 'RECEIPT_NOT_FOUND');
      }

      const subtotal = receipt.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const tax = receipt.tax;
      const total = subtotal + tax;
      const now = new Date();

      await tx.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: 'SUCCEEDED',
          providerTransactionId: paymentId,
          completedAt: now,
          failedAt: null,
          lastError: null,
          rawWebhook: input.rawPayload as Prisma.InputJsonValue,
          metadata: {
            ...(((paymentAttempt.metadata as Prisma.JsonObject | null) || {})),
            hmacVerified: input.hmacVerified,
            transactionId: paymentId,
            success: true,
          },
        },
      });

      await tx.cartSession.update({
        where: { id: paymentAttempt.sessionId },
        data: {
          status: 'CHECKED_OUT',
          endedAt: receipt.lockedAt ?? now,
        },
      });

      if (receipt.cartId) {
        await tx.cart.update({
          where: { id: receipt.cartId },
          data: {
            status: 'AVAILABLE',
            pairingCode: null,
            pairingExpiresAt: null,
            qrSessionId: null,
            lastSeen: now,
          },
        });
      }

      await tx.receipt.update({
        where: { id: receipt.id },
        data: {
          status: 'PAID',
          lockedAt: receipt.lockedAt ?? now,
          subtotal,
          tax,
          total,
          paymentId,
          paymentMethod: 'CARD',
          paymentStatus: 'COMPLETED',
        },
      });
    });

    if (!wasAlreadySucceeded) {
      await recordUserPurchaseArtifacts({
        receiptId: paymentAttempt.receiptId,
        sessionId: paymentAttempt.sessionId,
        paymentId,
      });
    }

    return {
      paymentAttemptId: paymentAttempt.id,
      receiptId: paymentAttempt.receiptId,
      sessionId: paymentAttempt.sessionId,
      paymentId,
    };
  }

  public static async markPaymobPaymentFailed(input: PaymobWebhookInput, reason?: string | null) {
    const providerOrderId = input.transaction?.order?.id ? String(input.transaction.order.id) : null;
    const merchantOrderId = input.transaction?.order?.merchant_order_id
      ? String(input.transaction.order.merchant_order_id)
      : null;
    const lookup = [
      ...(providerOrderId ? [{ providerOrderId }] : []),
      ...(merchantOrderId ? [{ merchantOrderId }] : []),
    ];

    if (lookup.length === 0) {
      throw new ApiErrorResponse('Paymob webhook is missing order identifiers.', 400, 'INVALID_PAYMOB_WEBHOOK');
    }

    const paymentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        OR: lookup,
      },
    });

    if (!paymentAttempt) {
      throw new ApiErrorResponse('Payment attempt not found for this Paymob webhook.', 404, 'PAYMENT_ATTEMPT_NOT_FOUND');
    }

    await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findUnique({
        where: { id: paymentAttempt.receiptId },
        select: {
          status: true,
        },
      });

      await tx.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: paymentAttempt.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
          failedAt: paymentAttempt.status === 'SUCCEEDED' ? paymentAttempt.failedAt : new Date(),
          lastError: paymentAttempt.status === 'SUCCEEDED'
            ? paymentAttempt.lastError
            : reason || 'Paymob reported a failed payment.',
          providerTransactionId: input.transaction?.id ? String(input.transaction.id) : paymentAttempt.providerTransactionId,
          rawWebhook: input.rawPayload as Prisma.InputJsonValue,
          metadata: {
            ...(((paymentAttempt.metadata as Prisma.JsonObject | null) || {})),
            hmacVerified: input.hmacVerified,
            failureReason: reason || null,
            success: false,
          },
        },
      });

      if (receipt?.status !== 'PAID') {
        await tx.receipt.update({
          where: { id: paymentAttempt.receiptId },
          data: {
            paymentStatus: 'FAILED',
          },
        });
      }
    });

    return paymentAttempt;
  }
}
