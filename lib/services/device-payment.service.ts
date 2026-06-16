import crypto from 'crypto';
import { PaymentStatus, Prisma, ReceiptStatus, SessionStatus } from '@prisma/client';
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
  buildPaymentQrUrl,
  createPaymentQrExpiry,
  formatMoney,
  generateSecureToken,
  hashToken,
  isPaymentQrExpired,
} from '@/lib/payment-checkout-qr';
import {
  buildPaymobBillingData,
  buildPaymobCustomer,
  buildPaymobUnifiedCheckoutUrl,
  createPaymobIntention,
} from '@/lib/paymob';
import { getHostedPaymobEnvDebugInfo, getHostedPaymobEnvStatus, isPaymobPreviewModeEnabled } from '@/lib/paymob/env';
import { calculateTax } from '@/lib/utils';

const REUSABLE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

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

type ActiveCheckoutSession = {
  id: string;
  status: SessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  userId: string | null;
  guestSessionId: string | null;
  cartId: string;
  cart: {
    id: string;
    cartCode: string;
    status: string;
    storeId: string;
    store: {
      id: string;
      name: string;
      currency: string;
    } | null;
  } | null;
  shoppingList: {
    id: string;
    name: string;
  } | null;
  receipt: {
    id: string;
    status: ReceiptStatus;
    paymentStatus: PaymentStatus;
    total: number;
    subtotal: number;
    tax: number;
    lockedAt: Date | null;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
      category: string | null;
    }>;
    paymentAttempts: Array<{
      id: string;
      status: string;
      checkoutUrl: string | null;
      amountCents: number;
      currency: string;
      paymentTokenHash: string | null;
      expiresAt: Date | null;
      metadata: Prisma.JsonValue | null;
    }>;
  } | null;
};

function buildMerchantOrderId() {
  return `carto_${crypto.randomUUID().replace(/-/g, '')}`;
}

function buildSecurePreviewCheckoutUrl(attemptId: string) {
  return `/payment/secure-preview?attemptId=${encodeURIComponent(attemptId)}`;
}

function isReceiptPaidStatus(status?: string | null, paymentStatus?: string | null) {
  return status === 'PAID' || paymentStatus === 'COMPLETED';
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

  return Boolean(
    (input.checkoutUrl && input.checkoutUrl.startsWith('/')) ||
    metadata.preview === true ||
    metadata.checkoutMode === 'preview'
  );
}

function buildPaymobConfigErrorMessage(missing: string[]) {
  return `Paymob test mode is not configured. Missing: ${missing.join(', ')}. If you just added these variables in Vercel, redeploy the project.`;
}

function buildPaymobProviderErrorDetails(input: {
  error: unknown;
  amountMinorUnits: number;
  receiptId: string;
  sessionId: string;
  paymentAttemptId: string;
}) {
  const message = input.error instanceof Error
    ? input.error.message
    : typeof input.error === 'string'
      ? input.error
      : 'Could not initialize Paymob checkout.';
  const normalizedMessage = message.replace(/\s+/g, ' ').trim();

  return {
    provider: 'PAYMOB',
    providerMessage: normalizedMessage,
    amountMinorUnits: input.amountMinorUnits,
    currency: PAYMOB_CURRENCY,
    receiptId: input.receiptId,
    sessionId: input.sessionId,
    paymentAttemptId: input.paymentAttemptId,
  };
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

async function loadActiveCheckoutSession(
  tx: Prisma.TransactionClient,
  cartId: string
): Promise<ActiveCheckoutSession | null> {
  return tx.cartSession.findFirst({
    where: {
      cartId,
      status: 'ACTIVE',
      endedAt: null,
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      endedAt: true,
      userId: true,
      guestSessionId: true,
      cartId: true,
      cart: {
        select: {
          id: true,
          cartCode: true,
          status: true,
          storeId: true,
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
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          total: true,
          subtotal: true,
          tax: true,
          lockedAt: true,
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
              price: true,
              category: true,
            },
            orderBy: { scannedAt: 'desc' },
          },
          paymentAttempts: {
            select: {
              id: true,
              status: true,
              checkoutUrl: true,
              amountCents: true,
              currency: true,
              paymentTokenHash: true,
              expiresAt: true,
              metadata: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });
}

async function lockActiveReceiptForDeviceCheckout(
  tx: Prisma.TransactionClient,
  cart: DeviceCart
) {
  const cartSession = await loadActiveCheckoutSession(tx, cart.id);

  if (!cartSession) {
    throw new ApiErrorResponse('No active cart session is available for this cart.', 404, 'NO_ACTIVE_SESSION');
  }

  if (!cartSession.receipt) {
    throw new ApiErrorResponse('No receipt exists for the active cart session.', 404, 'RECEIPT_NOT_FOUND');
  }

  if (cartSession.receipt.status === 'PAID') {
    throw new ApiErrorResponse('This receipt has already been paid.', 409, 'RECEIPT_ALREADY_PAID');
  }

  if (cartSession.receipt.paymentStatus === 'COMPLETED') {
    throw new ApiErrorResponse('Payment for this receipt has already been completed.', 409, 'PAYMENT_ALREADY_COMPLETED');
  }

  const subtotal = cartSession.receipt.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = calculateTax(subtotal);
  const total = subtotal + tax;

  if (!Number.isFinite(total) || total <= 0) {
    throw new ApiErrorResponse(
      'Cannot generate a payment QR because the receipt total is invalid.',
      400,
      'INVALID_RECEIPT_TOTAL',
    );
  }

  const storeCurrency = cartSession.cart?.store?.currency?.trim().toUpperCase() || PAYMOB_CURRENCY;
  if (storeCurrency !== PAYMOB_CURRENCY) {
    throw new ApiErrorResponse(
      `Cannot generate a payment QR because the receipt currency must be ${PAYMOB_CURRENCY}.`,
      400,
      'INVALID_RECEIPT_CURRENCY',
    );
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
    where: { id: cart.id },
    data: {
      status: 'IN_USE',
      lastSeen: new Date(),
    },
  });

  const lockedSession = await loadActiveCheckoutSession(tx, cart.id);

  if (!lockedSession?.receipt) {
    throw new ApiErrorResponse('Receipt is not ready for payment.', 409, 'RECEIPT_NOT_READY');
  }

  return lockedSession;
}

export class DevicePaymentService {
  public static buildDeviceCheckoutUrl(attemptId: string, requestUrl?: string) {
    return `${getAppBaseUrl(requestUrl)}/checkout/${encodeURIComponent(attemptId)}`;
  }

  public static async createPaymentQr(
    cart: DeviceCart,
    requestUrl?: string
  ) {
    const lockedSession = await prisma.$transaction((tx) => (
      lockActiveReceiptForDeviceCheckout(tx, cart)
    ));
    const receipt = lockedSession.receipt;

    if (!receipt) {
      throw new ApiErrorResponse('Receipt is not ready for payment.', 409, 'RECEIPT_NOT_READY');
    }

    const checkoutAmount = getPaymobAmountMinorUnits(receipt);

    if (checkoutAmount.demoAmountFallback || checkoutAmount.amountMinorUnits <= 0) {
      throw new ApiErrorResponse(
        'Cannot generate a payment QR because the receipt total is invalid.',
        400,
        'INVALID_RECEIPT_TOTAL',
      );
    }

    const paymobEnvStatus = getHostedPaymobEnvStatus();
    const previewModeEnabled = isPaymobPreviewModeEnabled();
    const usePreviewMode = !paymobEnvStatus.configured && previewModeEnabled;

    if (!paymobEnvStatus.configured && !previewModeEnabled) {
      const debugInfo = getHostedPaymobEnvDebugInfo();
      console.warn('Paymob hosted checkout is not configured for device checkout.', debugInfo);
      throw new ApiErrorResponse(
        buildPaymobConfigErrorMessage(paymobEnvStatus.missing),
        503,
        'PAYMOB_NOT_CONFIGURED',
        {
          missing: paymobEnvStatus.missing,
          hasApiKey: debugInfo.hasApiKey,
          hasSecretKey: debugInfo.hasSecretKey,
          hasPublicKey: debugInfo.hasPublicKey,
          hasHmacSecret: debugInfo.hasHmacSecret,
          integrationIdParsed: debugInfo.integrationIdParsed,
        },
      );
    }

    let attempt = await reuseRecentAttempt(receipt.id, checkoutAmount.amountMinorUnits);

    if (attempt && isPreviewAttempt(attempt) !== usePreviewMode) {
      attempt = null;
    }

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
            checkoutMode: usePreviewMode ? 'preview' : 'hosted',
            source: 'device_payment_qr',
          },
        },
      });

      if (usePreviewMode) {
        attempt = await prisma.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            checkoutUrl: buildSecurePreviewCheckoutUrl(paymentAttempt.id),
            metadata: {
              cartCode: lockedSession.cart?.cartCode ?? cart.cartCode,
              storeId: lockedSession.cart?.storeId ?? null,
              storeName: lockedSession.cart?.store?.name ?? null,
              listId: lockedSession.shoppingList?.id ?? null,
              listName: lockedSession.shoppingList?.name ?? null,
              actualReceiptTotal: receipt.total,
              payableAmountEGP: checkoutAmount.amount,
              demoAmountFallback: checkoutAmount.demoAmountFallback,
              checkoutMode: 'preview',
              source: 'device_payment_qr',
              previewReason: 'PAYMOB_NOT_CONFIGURED',
              previewMissing: paymobEnvStatus.missing,
              previewExplicit: true,
              preview: true,
            },
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
          const providerErrorDetails = buildPaymobProviderErrorDetails({
            error,
            amountMinorUnits: paymentAttempt.amountCents,
            receiptId: receipt.id,
            sessionId: lockedSession.id,
            paymentAttemptId: paymentAttempt.id,
          });

          await prisma.paymentAttempt.update({
            where: { id: paymentAttempt.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              lastError: providerErrorDetails.providerMessage,
            },
          });

          throw new ApiErrorResponse(
            `Could not initialize secure payment checkout. ${providerErrorDetails.providerMessage}`,
            502,
            'PAYMENT_PROVIDER_ERROR',
            providerErrorDetails,
          );
        }
      }
    }

    if (!attempt.checkoutUrl) {
      throw new ApiErrorResponse('Secure payment checkout URL is missing.', 500, 'PAYMENT_URL_MISSING');
    }

    const accessToken = generateSecureToken();
    const tokenExpiresAt = createPaymentQrExpiry();
    const qrValue = buildPaymentQrUrl(accessToken, requestUrl);

    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        paymentTokenHash: hashToken(accessToken),
        expiresAt: tokenExpiresAt,
      },
    });

    return {
      type: 'payment_checkout' as const,
      paymentAttemptId: attempt.id,
      paymentUrl: qrValue,
      qrValue,
      receiptId: receipt.id,
      sessionId: lockedSession.id,
      cartSessionId: lockedSession.id,
      amountCents: checkoutAmount.amountMinorUnits,
      amount: checkoutAmount.amount,
      amountDisplay: formatMoney(checkoutAmount.amountMinorUnits, PAYMOB_CURRENCY),
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

    if (isPaymentQrExpired(attempt.expiresAt)) {
      return null;
    }

    if (hashToken(token) !== attempt.paymentTokenHash) {
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
