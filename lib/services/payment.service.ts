import crypto from 'crypto';
import { PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiErrorResponse } from '@/lib/api-response';
import type { RequestOwner } from '@/lib/guest-session';
import { ownerWhere } from '@/lib/guest-session';
import { isActiveCartSessionStatus } from '@/lib/cart-session-status';
import {
  centsToAmount,
  formatPaymentCurrency,
  getPaymobAmountMinorUnits,
  PAYMOB_CURRENCY,
  toPaymobAmountCents,
} from '@/lib/payment-money';
import {
  buildPaymobBillingData,
  buildPaymobCustomer,
  buildPaymobUnifiedCheckoutUrl,
  createPaymobIntention,
} from '@/lib/paymob';
import { getHostedPaymobEnvStatus, isPaymobPreviewModeEnabled } from '@/lib/paymob/env';

const REUSABLE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

type CreateHostedCheckoutInput = {
  sessionId: string;
  receiptId?: string | null;
  paymentMethod?: PaymentMethod;
  mode?: 'standard' | 'bypass';
  allowZeroTotalPreview?: boolean;
};

type PaymobWebhookInput = {
  hmacVerified: boolean;
  rawPayload: unknown;
  transaction: Record<string, any>;
};

type OwnedAttemptView = {
  id: string;
  receiptId: string;
  sessionId: string;
  userId: string | null;
  guestSessionId: string | null;
  provider: string;
  merchantOrderId: string;
  providerOrderId: string | null;
  providerTransactionId: string | null;
  amountCents: number;
  currency: string;
  checkoutUrl: string | null;
  paymentTokenHash: string | null;
  expiresAt: Date | null;
  status: string;
  lastError: string | null;
  rawResponse: Prisma.JsonValue | null;
  rawWebhook: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  receipt: {
    id: string;
    total: number;
    status: string;
    paymentStatus: string;
    paidAt: Date | null;
  };
  cartSession: {
    status: string;
    endedAt: Date | null;
  } | null;
};

function readTransactionString(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function getTransactionExtras(transaction: Record<string, any>) {
  const candidates = [
    transaction?.order?.extras,
    transaction?.extras,
    transaction?.data?.extras,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }

  return null;
}

function buildWebhookLookup(transaction: Record<string, any>) {
  const providerOrderId = readTransactionString(transaction?.order?.id);
  const merchantOrderId = readTransactionString(transaction?.order?.merchant_order_id);
  const providerTransactionId = readTransactionString(transaction?.id);
  const extras = getTransactionExtras(transaction);
  const paymentAttemptId = readTransactionString(extras?.paymentAttemptId);

  return {
    providerOrderId,
    merchantOrderId,
    providerTransactionId,
    paymentAttemptId,
    clauses: [
      ...(paymentAttemptId ? [{ id: paymentAttemptId }] : []),
      ...(providerOrderId ? [{ providerOrderId }] : []),
      ...(merchantOrderId ? [{ merchantOrderId }] : []),
      ...(providerTransactionId ? [{ providerTransactionId }] : []),
    ],
  };
}

function buildMerchantOrderId() {
  return `carto_${crypto.randomUUID().replace(/-/g, '')}`;
}

function buildSecurePreviewCheckoutUrl(attemptId: string) {
  return `/payment/secure-preview?attemptId=${encodeURIComponent(attemptId)}`;
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
    await CartSessionService.lockOwnedReceiptForCheckout(owner, cartSession.id);
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

function buildPaymobItems(
  receipt: { items: Array<{ name: string; price: number; quantity: number; category: string | null }> },
  options?: { demoAmountFallback?: boolean; payableAmountEGP?: number }
) {
  if (options?.demoAmountFallback) {
      return [
        {
          name: 'Carto demo checkout',
          amount: toPaymobAmountCents(options.payableAmountEGP ?? 0),
          description: 'Demo fallback amount while receipt prices are still zero.',
          quantity: 1,
        },
    ];
  }

  return receipt.items.map((item) => ({
    name: item.name,
    amount: toPaymobAmountCents(item.price),
    description: item.category || item.name,
    quantity: item.quantity,
  }));
}

function readAttemptMetadata(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Prisma.JsonObject;
}

function isPreviewAttempt(input: {
  checkoutUrl?: string | null;
  metadata?: Prisma.JsonValue | null;
}) {
  const metadata = readAttemptMetadata(input.metadata);

  return (
    isPreviewCheckoutUrl(input.checkoutUrl) ||
    metadata.preview === true ||
    metadata.checkoutMode === 'preview'
  );
}

function buildPaymobConfigErrorMessage(missing: string[]) {
  return `Paymob test mode is not configured. Missing: ${missing.join(', ')}. Add these server environment variables and redeploy before opening checkout.`;
}

async function reuseRecentAttempt(receiptId: string, amountCents: number) {
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
      amountCents,
    },
    orderBy: { createdAt: 'desc' },
  });

  return attempt;
}

function isPreviewCheckoutUrl(checkoutUrl?: string | null) {
  return Boolean(checkoutUrl && checkoutUrl.startsWith('/'));
}

async function attachCartSessionState(
  attempt: Prisma.PaymentAttemptGetPayload<{
    include: {
      receipt: {
        select: {
          id: true;
          total: true;
          status: true;
          paymentStatus: true;
          paidAt: true;
        };
      };
    };
  }> | null
): Promise<OwnedAttemptView | null> {
  if (!attempt) {
    return null;
  }

  const cartSession = await prisma.cartSession.findUnique({
    where: { id: attempt.sessionId },
    select: {
      status: true,
      endedAt: true,
    },
  });

  return {
    ...attempt,
    cartSession,
  };
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
        preview: false,
        demoAmountFallback: false,
        amount: receipt.total,
        currency: PAYMOB_CURRENCY,
        checkoutUrl: null,
      };
    }

    const checkoutAmount = getPaymobAmountMinorUnits(receipt);

    if (checkoutAmount.demoAmountFallback && !checkoutAmount.fallbackAllowed) {
      throw new ApiErrorResponse('Receipt total must be greater than zero before payment.', 400, 'INVALID_PAYMENT_AMOUNT');
    }

    const paymobEnvStatus = getHostedPaymobEnvStatus();
    const previewModeEnabled = isPaymobPreviewModeEnabled();
    const usePreviewMode = !paymobEnvStatus.configured && previewModeEnabled;

    if (!paymobEnvStatus.configured && !previewModeEnabled) {
      throw new ApiErrorResponse(
        buildPaymobConfigErrorMessage(paymobEnvStatus.missing),
        503,
        'PAYMOB_NOT_CONFIGURED',
      );
    }

    const existingAttempt = await reuseRecentAttempt(receipt.id, checkoutAmount.amountMinorUnits);
    if (existingAttempt?.checkoutUrl) {
      const attemptMetadata = readAttemptMetadata(existingAttempt.metadata);
      const existingAttemptIsPreview = isPreviewAttempt(existingAttempt);

      if (existingAttemptIsPreview !== usePreviewMode) {
        // Ignore stale attempts from the wrong checkout mode so real Paymob can replace preview,
        // and local preview mode can replace stale hosted attempts when credentials are missing.
      } else {
        return {
          alreadyPaid: false,
          sessionId: cartSession.id,
          receiptId: receipt.id,
          attemptId: existingAttempt.id,
          preview: existingAttemptIsPreview,
          amount: centsToAmount(existingAttempt.amountCents),
          currency: existingAttempt.currency,
          checkoutUrl: existingAttempt.checkoutUrl,
          demoAmountFallback: attemptMetadata.demoAmountFallback === true,
        };
      }
    }
    const baseMetadata = {
      cartCode: cartSession.cart?.cartCode ?? null,
      storeId: cartSession.cart?.storeId ?? null,
      storeName: cartSession.cart?.store?.name ?? null,
      listId: cartSession.shoppingList?.id ?? null,
      listName: cartSession.shoppingList?.name ?? null,
      paymentMethod: input.paymentMethod ?? receipt.paymentMethod,
      actualReceiptTotal: receipt.total,
      payableAmountEGP: checkoutAmount.amount,
      demoAmountFallback: checkoutAmount.demoAmountFallback,
      checkoutMode: usePreviewMode ? 'preview' : 'hosted',
    };

    const merchantOrderId = buildMerchantOrderId();
    const paymentAttempt = await prisma.paymentAttempt.create({
      data: {
        receiptId: receipt.id,
        sessionId: cartSession.id,
        userId: owner.type === 'user' ? owner.userId : null,
        guestSessionId: owner.type === 'guest' ? owner.guestSessionId : null,
        merchantOrderId,
        amountCents: checkoutAmount.amountMinorUnits,
        currency: PAYMOB_CURRENCY,
        status: 'PENDING',
        metadata: baseMetadata,
      },
    });

    if (usePreviewMode) {
      const checkoutUrl = buildSecurePreviewCheckoutUrl(paymentAttempt.id);

      await prisma.$transaction([
        prisma.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            checkoutUrl,
            metadata: {
              ...baseMetadata,
              checkoutMode: 'preview',
              previewReason: 'PAYMOB_NOT_CONFIGURED',
              previewMissing: paymobEnvStatus.missing,
              previewExplicit: true,
              preview: true,
            },
          },
        }),
        prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            paymentMethod: input.paymentMethod ?? receipt.paymentMethod,
            paymentStatus: 'PENDING',
          },
        }),
      ]);

      return {
        alreadyPaid: false,
        sessionId: cartSession.id,
        receiptId: receipt.id,
        attemptId: paymentAttempt.id,
        preview: true,
        amount: checkoutAmount.amount,
        currency: PAYMOB_CURRENCY,
        checkoutUrl,
        demoAmountFallback: checkoutAmount.demoAmountFallback,
      };
    }

    try {
      const profile = await getReceiptOwnerProfile(owner);
      const billingData = buildPaymobBillingData(profile ?? {});
      const customer = buildPaymobCustomer(profile ?? {});
      const intention = await createPaymobIntention({
        amount: checkoutAmount.amountMinorUnits,
        items: buildPaymobItems(receipt, checkoutAmount),
        billingData,
        customer,
        extras: {
          receiptId: receipt.id,
          cartSessionId: cartSession.id,
          paymentAttemptId: paymentAttempt.id,
          internalReference: merchantOrderId,
          merchantOrderId,
        },
      });
      const checkoutUrl = buildPaymobUnifiedCheckoutUrl(intention.clientSecret);

      await prisma.$transaction([
        prisma.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            providerOrderId: intention.id,
            checkoutUrl,
            status: 'PROCESSING',
            rawResponse: {
              intention: intention.raw,
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
        preview: false,
        amount: checkoutAmount.amount,
        currency: PAYMOB_CURRENCY,
        checkoutUrl,
        demoAmountFallback: checkoutAmount.demoAmountFallback,
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

      throw new ApiErrorResponse('Could not initialize secure payment checkout.', 502, 'PAYMENT_PROVIDER_ERROR');
    }
  }

  public static async getOwnedAttempt(owner: RequestOwner, attemptId: string) {
    const attempt = await prisma.paymentAttempt.findFirst({
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
            paidAt: true,
          },
        },
      },
    });

    return attachCartSessionState(attempt);
  }

  public static async getLatestOwnedAttempt(owner: RequestOwner, sessionId?: string | null) {
    const attempt = await prisma.paymentAttempt.findFirst({
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
            paidAt: true,
          },
        },
      },
    });

    return attachCartSessionState(attempt);
  }

  public static async markPaymobPaymentSucceeded(input: PaymobWebhookInput) {
    const lookup = buildWebhookLookup(input.transaction);

    if (lookup.clauses.length === 0) {
      throw new ApiErrorResponse('Paymob webhook is missing order identifiers.', 400, 'INVALID_PAYMOB_WEBHOOK');
    }

    const paymentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        OR: lookup.clauses,
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
          endedAt: now,
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
          paidAt: now,
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
    const lookup = buildWebhookLookup(input.transaction);

    if (lookup.clauses.length === 0) {
      throw new ApiErrorResponse('Paymob webhook is missing order identifiers.', 400, 'INVALID_PAYMOB_WEBHOOK');
    }

    const paymentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        OR: lookup.clauses,
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
