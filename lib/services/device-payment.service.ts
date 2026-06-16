import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiErrorResponse } from '@/lib/api-response';
import { getAppBaseUrl } from '@/lib/app-url';
import {
  centsToAmount,
  getPaymobAmountMinorUnits,
  PAYMOB_CURRENCY,
  toPaymobAmountCents,
} from '@/lib/payment-money';
import {
  buildPaymobBillingData,
  buildPaymobCustomer,
  buildPaymobUnifiedCheckoutUrl,
  createPaymobIntention,
  isPaymobConfigured,
} from '@/lib/paymob';
import { calculateTax } from '@/lib/utils';

const REUSABLE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const PAYMENT_ACCESS_TOKEN_TTL_MS = 30 * 60 * 1000;

type DeviceCart = {
  id: string;
  cartCode: string;
  status: string;
  storeId?: string | null;
};

const publicCheckoutAttemptSelect = {
  id: true,
  sessionId: true,
  receiptId: true,
  amountCents: true,
  currency: true,
  checkoutUrl: true,
  status: true,
  completedAt: true,
  failedAt: true,
  expiresAt: true,
  paymentTokenHash: true,
  metadata: true,
  receipt: {
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      subtotal: true,
      tax: true,
      total: true,
      lockedAt: true,
      paidAt: true,
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          price: true,
          category: true,
        },
        orderBy: { scannedAt: 'desc' as const },
      },
    },
  },
} satisfies Prisma.PaymentAttemptSelect;

type PublicCheckoutAttempt = Prisma.PaymentAttemptGetPayload<{
  select: typeof publicCheckoutAttemptSelect;
}>;

type PublicCheckoutSession = {
  id: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  cart: {
    id: string;
    cartCode: string;
    status: string;
    storeId: string;
  } | null;
  shoppingList: {
    id: string;
    name: string;
  } | null;
};

function buildMerchantOrderId() {
  return `carto_${crypto.randomUUID().replace(/-/g, '')}`;
}

function buildSecurePreviewCheckoutUrl(attemptId: string) {
  return `/payment/secure-preview?attemptId=${encodeURIComponent(attemptId)}`;
}

function buildPublicCheckoutUrl(attemptId: string, token: string, requestUrl?: string) {
  const url = new URL(`/checkout/${encodeURIComponent(attemptId)}`, getAppBaseUrl(requestUrl));
  url.searchParams.set('token', token);
  return url.toString();
}

function createAccessToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function hashAccessToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isReceiptPaidStatus(status?: string | null, paymentStatus?: string | null) {
  return status === 'PAID' || paymentStatus === 'COMPLETED';
}

function mapDevicePaymentStatus(input: {
  receiptStatus?: string | null;
  receiptPaymentStatus?: string | null;
  attemptStatus?: string | null;
}) {
  if (
    isReceiptPaidStatus(input.receiptStatus ?? null, input.receiptPaymentStatus) ||
    input.attemptStatus === 'SUCCEEDED'
  ) {
    return 'PAID' as const;
  }

  if (input.receiptPaymentStatus === 'FAILED' || input.attemptStatus === 'FAILED') {
    return 'FAILED' as const;
  }

  return 'PENDING' as const;
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

async function getDeviceCheckoutProfile(session: {
  userId: string | null;
}) {
  if (!session.userId) {
    return {
      name: 'Guest Shopper',
      email: null,
      phoneNumber: null,
    };
  }

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      phoneNumber: true,
    },
  });
}

async function reuseRecentAttempt(receiptId: string, amountCents: number) {
  return prisma.paymentAttempt.findFirst({
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
}

async function lockReceiptForDeviceCheckout(
  tx: Prisma.TransactionClient,
  cartId: string,
  cartSessionId: string,
  receiptId: string
) {
  const cartSession = await tx.cartSession.findFirst({
    where: {
      id: cartSessionId,
      cartId,
    },
    include: {
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
      receipt: {
        include: {
          items: {
            orderBy: { scannedAt: 'desc' },
          },
          paymentAttempts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!cartSession) {
    throw new ApiErrorResponse('Cart session not found for this cart.', 404, 'SESSION_NOT_FOUND');
  }

  if (!['ACTIVE', 'COMPLETED'].includes(cartSession.status)) {
    throw new ApiErrorResponse('Cart session is not active or ready for checkout.', 409, 'SESSION_NOT_READY');
  }

  if (!cartSession.receipt || cartSession.receipt.id !== receiptId) {
    throw new ApiErrorResponse('Receipt does not belong to this cart session.', 403, 'RECEIPT_SESSION_MISMATCH');
  }

  if (cartSession.receipt.status === 'PAID' || cartSession.receipt.paymentStatus === 'COMPLETED') {
    throw new ApiErrorResponse('Receipt is already paid.', 409, 'RECEIPT_ALREADY_PAID');
  }

  const subtotal = cartSession.receipt.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = calculateTax(subtotal);
  const total = subtotal + tax;
  const checkoutAmount = getPaymobAmountMinorUnits({ total });

  if (checkoutAmount.demoAmountFallback && !checkoutAmount.fallbackAllowed) {
    throw new ApiErrorResponse('Receipt total must be greater than zero before payment.', 400, 'INVALID_PAYMENT_AMOUNT');
  }

  await tx.receipt.update({
    where: { id: cartSession.receipt.id },
    data: {
      status: cartSession.receipt.status === 'DRAFT' ? 'LOCKED' : cartSession.receipt.status,
      lockedAt: cartSession.receipt.lockedAt ?? new Date(),
      subtotal,
      tax,
      total,
      paymentStatus: cartSession.receipt.paymentStatus === 'FAILED' ? 'PENDING' : cartSession.receipt.paymentStatus,
      cartId: cartSession.cartId,
      storeId: cartSession.cart?.storeId ?? null,
    },
  });

  await tx.cart.update({
    where: { id: cartId },
    data: {
      status: 'IN_USE',
      lastSeen: new Date(),
    },
  });

  return tx.cartSession.findFirstOrThrow({
    where: {
      id: cartSessionId,
      cartId,
    },
    include: {
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
      receipt: {
        include: {
          items: {
            orderBy: { scannedAt: 'desc' },
          },
          paymentAttempts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });
}

export class DevicePaymentService {
  public static buildDeviceCheckoutUrl(attemptId: string, requestUrl?: string) {
    return `${getAppBaseUrl(requestUrl)}/checkout/${encodeURIComponent(attemptId)}`;
  }

  public static async createPaymentQr(
    cart: DeviceCart,
    input: { cartSessionId: string; receiptId: string },
    requestUrl?: string
  ) {
    const lockedSession = await prisma.$transaction((tx) => (
      lockReceiptForDeviceCheckout(tx, cart.id, input.cartSessionId, input.receiptId)
    ));
    const receipt = lockedSession.receipt;

    if (!receipt) {
      throw new ApiErrorResponse('Receipt is not ready for payment.', 409, 'RECEIPT_NOT_READY');
    }

    const checkoutAmount = getPaymobAmountMinorUnits(receipt);

    if (checkoutAmount.demoAmountFallback && !checkoutAmount.fallbackAllowed) {
      throw new ApiErrorResponse('Receipt total must be greater than zero before payment.', 400, 'INVALID_PAYMENT_AMOUNT');
    }

    let attempt = await reuseRecentAttempt(receipt.id, checkoutAmount.amountMinorUnits);

    if (!attempt) {
      const paymentAttempt = await prisma.paymentAttempt.create({
        data: {
          receiptId: receipt.id,
          sessionId: lockedSession.id,
          userId: lockedSession.userId,
          guestSessionId: lockedSession.guestSessionId,
          merchantOrderId: buildMerchantOrderId(),
          amountCents: checkoutAmount.amountMinorUnits,
          currency: PAYMOB_CURRENCY,
          status: 'PENDING',
          metadata: {
            cartCode: lockedSession.cart?.cartCode ?? cart.cartCode,
            storeId: lockedSession.cart?.storeId ?? null,
            storeName: lockedSession.cart?.store?.name ?? null,
            listId: lockedSession.shoppingList?.id ?? null,
            listName: lockedSession.shoppingList?.name ?? null,
            actualReceiptTotal: receipt.total,
            payableAmountEGP: checkoutAmount.amount,
            demoAmountFallback: checkoutAmount.demoAmountFallback,
            checkoutMode: isPaymobConfigured() ? 'hosted' : 'preview',
            source: 'device_payment_qr',
          },
        },
      });

      if (!isPaymobConfigured()) {
        attempt = await prisma.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            checkoutUrl: buildSecurePreviewCheckoutUrl(paymentAttempt.id),
          },
        });

        await prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            paymentStatus: 'PENDING',
          },
        });
      } else {
        try {
          const profile = await getDeviceCheckoutProfile(lockedSession);
          const billingData = buildPaymobBillingData(profile ?? {});
          const customer = buildPaymobCustomer(profile ?? {});
          const intention = await createPaymobIntention({
            amount: paymentAttempt.amountCents,
            items: buildPaymobItems(receipt, checkoutAmount),
            billingData,
            customer,
            extras: {
              receiptId: receipt.id,
              cartSessionId: lockedSession.id,
              paymentAttemptId: paymentAttempt.id,
              internalReference: paymentAttempt.merchantOrderId,
              merchantOrderId: paymentAttempt.merchantOrderId,
            },
          });
          const checkoutUrl = buildPaymobUnifiedCheckoutUrl(intention.clientSecret);

          attempt = await prisma.paymentAttempt.update({
            where: { id: paymentAttempt.id },
            data: {
              providerOrderId: intention.id,
              checkoutUrl,
              status: 'PROCESSING',
              rawResponse: {
                intention: intention.raw,
              },
            },
          });

          await prisma.receipt.update({
            where: { id: receipt.id },
            data: {
              paymentStatus: 'PROCESSING',
            },
          });
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
    }

    if (!attempt.checkoutUrl) {
      throw new ApiErrorResponse('Secure payment checkout URL is missing.', 500, 'PAYMENT_URL_MISSING');
    }

    const accessToken = createAccessToken();
    const tokenExpiresAt = new Date(Date.now() + PAYMENT_ACCESS_TOKEN_TTL_MS);

    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        paymentTokenHash: hashAccessToken(accessToken),
        expiresAt: tokenExpiresAt,
      },
    });

    const paymentUrl = buildPublicCheckoutUrl(attempt.id, accessToken, requestUrl);

    return {
      paymentAttemptId: attempt.id,
      paymentUrl,
      qrValue: paymentUrl,
      receiptId: receipt.id,
      cartSessionId: lockedSession.id,
      amount: checkoutAmount.amount,
      currency: PAYMOB_CURRENCY,
      paymentStatus: mapDevicePaymentStatus({
        receiptStatus: receipt.status,
        receiptPaymentStatus: receipt.paymentStatus,
        attemptStatus: attempt.status,
      }),
      demoAmountFallback: checkoutAmount.demoAmountFallback,
      expiresAt: tokenExpiresAt.toISOString(),
    };
  }

  public static async getPaymentStatus(cart: DeviceCart, receiptId: string) {
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        cartId: cart.id,
      },
      include: {
        items: true,
        cartSession: {
          select: {
            id: true,
            status: true,
            endedAt: true,
            cart: {
              select: {
                status: true,
                cartCode: true,
              },
            },
          },
        },
        paymentAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!receipt) {
      throw new ApiErrorResponse('Receipt not found for this cart.', 404, 'RECEIPT_NOT_FOUND');
    }

    const subtotal = receipt.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = receipt.tax || calculateTax(subtotal);
    const latestAttempt = receipt.paymentAttempts[0] ?? null;
    const amount = latestAttempt ? centsToAmount(latestAttempt.amountCents) : receipt.total > 0 ? receipt.total : subtotal + tax;
    const paymentStatus = mapDevicePaymentStatus({
      receiptStatus: receipt.status,
      receiptPaymentStatus: receipt.paymentStatus,
      attemptStatus: latestAttempt?.status ?? null,
    });

    return {
      receiptId: receipt.id,
      cartSessionId: receipt.sessionId,
      paymentStatus,
      receiptStatus: receipt.status,
      cartSessionStatus: receipt.cartSession?.status ?? null,
      cartStatus: paymentStatus === 'PAID'
        ? 'AVAILABLE'
        : receipt.cartSession?.cart?.status ?? cart.status,
      amount,
      currency: PAYMOB_CURRENCY,
      paidAt: receipt.paidAt?.toISOString() ?? latestAttempt?.completedAt?.toISOString() ?? null,
    };
  }

  public static async getPublicCheckoutAttempt(attemptId: string, token: string) {
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      select: publicCheckoutAttemptSelect,
    });

    if (!attempt || !attempt.paymentTokenHash) {
      return null;
    }

    if (attempt.expiresAt && attempt.expiresAt.getTime() < Date.now()) {
      return null;
    }

    if (hashAccessToken(token) !== attempt.paymentTokenHash) {
      return null;
    }

    const session = await prisma.cartSession.findUnique({
      where: { id: attempt.sessionId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        cart: {
          select: {
            id: true,
            cartCode: true,
            status: true,
            storeId: true,
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

    return {
      attempt,
      session,
    };
  }

  public static getPublicCheckoutView(
    payload: { attempt: PublicCheckoutAttempt; session: PublicCheckoutSession | null },
    requestUrl?: string
  ) {
    const { attempt, session } = payload;
    const publicStatus = mapDevicePaymentStatus({
      receiptStatus: attempt.receipt?.status ?? null,
      receiptPaymentStatus: attempt.receipt?.paymentStatus ?? null,
      attemptStatus: attempt.status,
    });

    return {
      id: attempt.id,
      sessionId: attempt.sessionId,
      receiptId: attempt.receiptId,
      amount: centsToAmount(attempt.amountCents),
      amountCents: attempt.amountCents,
      currency: attempt.currency,
      status: attempt.status,
      paymentStatus: publicStatus,
      receiptStatus: attempt.receipt?.status ?? null,
      checkoutUrl: attempt.checkoutUrl,
      expiresAt: attempt.expiresAt?.toISOString() ?? null,
      completedAt: attempt.completedAt?.toISOString() ?? null,
      paidAt: attempt.receipt?.paidAt?.toISOString() ?? attempt.completedAt?.toISOString() ?? null,
      cartCode: session?.cart?.cartCode ?? null,
      listName: session?.shoppingList?.name ?? null,
      items: attempt.receipt?.items ?? [],
      safeCheckoutPath: this.buildDeviceCheckoutUrl(attempt.id, requestUrl),
    };
  }

  public static buildActiveSessionPaymentSummary(input: {
    receipt: {
      id: string;
      status: string;
      paymentStatus?: string | null;
      total: number;
      paymentAttempts?: Array<{
        id: string;
        status: string;
      }>;
    } | null;
    requestUrl?: string;
  }) {
    const receipt = input.receipt;

    if (!receipt) {
      return null;
    }

    const latestAttempt = receipt.paymentAttempts?.[0] ?? null;

    return {
      receiptId: receipt.id,
      status: mapDevicePaymentStatus({
        receiptStatus: receipt.status,
        receiptPaymentStatus: receipt.paymentStatus,
        attemptStatus: latestAttempt?.status ?? null,
      }),
      currency: PAYMOB_CURRENCY,
      amount: receipt.total,
      paymentUrl: latestAttempt
        ? this.buildDeviceCheckoutUrl(latestAttempt.id, input.requestUrl)
        : null,
    };
  }
}
