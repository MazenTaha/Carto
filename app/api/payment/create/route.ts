import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createPaymentSchema } from '@/lib/validations';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { successResponse, errorResponse } from '@/lib/api-response';
import { CartSessionService } from '@/lib/services/cart-session.service';

export async function POST(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Request body must be valid JSON.', 400, 'INVALID_JSON');
    }

    const { receiptId, sessionId, amount, paymentMethod } = createPaymentSchema.parse(body);

    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        ...ownerWhere(owner),
      },
      select: {
        id: true,
        sessionId: true,
        status: true,
        paymentStatus: true,
        paymentId: true,
        total: true,
        items: {
          select: {
            name: true,
            quantity: true,
          },
        },
      },
    });

    if (!receipt) {
      return errorResponse('Receipt not found.', 404, 'NOT_FOUND');
    }

    if (receipt.sessionId !== sessionId) {
      return errorResponse('Receipt does not belong to this session.', 403, 'FORBIDDEN');
    }

    if (receipt.status === 'PAID' && receipt.paymentId) {
      return successResponse({
        paymentId: receipt.paymentId,
        paymentUrl: null,
        alreadyPaid: true,
      });
    }

    if (receipt.status !== 'LOCKED') {
      return errorResponse('Receipt must be finalized before payment.', 409, 'RECEIPT_NOT_READY');
    }

    if (Math.abs(receipt.total - amount) > 0.01) {
      return errorResponse('Payment amount does not match the finalized receipt total.', 400, 'INVALID_PAYMENT_AMOUNT');
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const mockPaymentId = `pi_mock_${Date.now()}`;
    let paymentUrl: string | null = null;

    if (stripeSecretKey && stripeSecretKey.startsWith('sk_live')) {
      paymentUrl = null;
    }

    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        paymentStatus: 'PROCESSING',
        paymentMethod,
      },
    });

    const cartSession = await CartSessionService.completeCheckout(sessionId, {
      paymentId: mockPaymentId,
      paymentMethod,
    });

    const finalizedReceipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      select: {
        total: true,
      },
    });

    if (!finalizedReceipt) {
      return errorResponse('Receipt not found after payment.', 404, 'NOT_FOUND');
    }

    if (owner.type === 'guest') {
      return successResponse({
        paymentId: mockPaymentId,
        paymentUrl,
      });
    }

    const currentStats = await prisma.userStats.findUnique({
      where: { userId: owner.userId },
    });

    const newTotalOrders = (currentStats?.totalOrders || 0) + 1;
    const newTotalSpent = (currentStats?.totalSpent || 0) + finalizedReceipt.total;
    const newAverage = newTotalSpent / newTotalOrders;

    await prisma.userStats.upsert({
      where: { userId: owner.userId },
      update: {
        totalOrders: newTotalOrders,
        totalSpent: newTotalSpent,
        averageBasketValue: newAverage,
      },
      create: {
        userId: owner.userId,
        totalOrders: 1,
        totalSpent: finalizedReceipt.total,
        averageBasketValue: finalizedReceipt.total,
      },
    });

    const purchasedItems: Array<{ name: string; quantity: number }> = receipt.items;
    const purchasedNames = Array.from(new Set(purchasedItems.map((item) => item.name.trim()).filter(Boolean)));
    const matchedProducts: Array<{ id: string; name: string }> = purchasedNames.length > 0
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
      purchasedItems.map((item) => {
        const product = productByName.get(item.name.toLowerCase());
        if (!product) return Promise.resolve();

        return prisma.userFavoriteProduct.upsert({
          where: {
            userId_productId: {
              userId: owner.userId,
              productId: product.id,
            },
          },
          update: {
            purchaseCount: { increment: item.quantity },
            lastPurchased: new Date(),
          },
          create: {
            userId: owner.userId,
            productId: product.id,
            purchaseCount: item.quantity,
          },
        });
      })
    );

    await prisma.notification.create({
      data: {
        userId: owner.userId,
        type: 'PAYMENT_SUCCESS',
        title: 'Payment Successful',
        message: `Your payment of $${finalizedReceipt.total.toFixed(2)} has been processed successfully.`,
        data: {
          receiptId,
          sessionId,
          paymentId: mockPaymentId,
          total: finalizedReceipt.total,
          cartSessionStatus: cartSession.status,
        },
      },
    });

    return successResponse({
      paymentId: mockPaymentId,
      paymentUrl,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    console.error('Error creating payment:', error);
    return errorResponse('Failed to create payment.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
