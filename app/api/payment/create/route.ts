// Payment creation API route

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createPaymentSchema } from '@/lib/validations';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';

// POST /api/payment/create - Create payment session
export async function POST(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { receiptId, sessionId, amount, paymentMethod } = createPaymentSchema.parse(body);

    // Verify receipt ownership
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        ...ownerWhere(owner),
        status: 'LOCKED',
      },
      select: {
        id: true,
        sessionId: true,
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
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    if (receipt.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Receipt does not belong to this session' }, { status: 403 });
    }

    // Update receipt payment status to PROCESSING
    await prisma.receipt.update({
      where: { id: receiptId },
      data: { paymentStatus: 'PROCESSING', paymentMethod },
    });

    // Process payment (mock for development, real Stripe in production)
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const mockPaymentId = `pi_mock_${Date.now()}`;
    let paymentUrl: string | null = null;

    if (stripeSecretKey && stripeSecretKey.startsWith('sk_live')) {
      // Real Stripe integration would go here
      // const stripe = require('stripe')(stripeSecretKey);
      // const paymentIntent = await stripe.paymentIntents.create({
      //   amount: Math.round(amount * 100),
      //   currency: 'usd',
      //   metadata: { receiptId, sessionId },
      // });
      // paymentUrl = paymentIntent.url;
    }

    // Mark receipt and session as paid/completed
    const cartSession = await prisma.$transaction(async (tx: any) => {
      await tx.receipt.update({
        where: { id: receiptId },
        data: {
          paymentId: mockPaymentId,
          status: 'PAID',
          paymentStatus: 'COMPLETED',
        },
      });

      return tx.cartSession.update({
        where: { id: sessionId },
        data: {
          status: 'CHECKED_OUT',
          endedAt: new Date(),
        },
        select: { cartId: true },
      });
    });

    if (cartSession) {
      await prisma.cart.update({
        where: { id: cartSession.cartId },
        data: { status: 'AVAILABLE' },
      }).catch(() => { /* Cart may not exist in Cart model if legacy session */ });
    }

    if (owner.type === 'guest') {
      return NextResponse.json({
        success: true,
        data: {
          paymentId: mockPaymentId,
          paymentUrl,
        },
      });
    }

    // ─── Update User Stats ───────────────────────────────────────────────────
    const currentStats = await prisma.userStats.findUnique({
      where: { userId: owner.userId },
    });

    const newTotalOrders = (currentStats?.totalOrders || 0) + 1;
    const newTotalSpent = (currentStats?.totalSpent || 0) + receipt.total;
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
        totalSpent: receipt.total,
        averageBasketValue: receipt.total,
      },
    });

    // ─── Track Favorite Products ─────────────────────────────────────────────
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

    // ─── Create Notification ─────────────────────────────────────────────────
    await prisma.notification.create({
      data: {
        userId: owner.userId,
        type: 'PAYMENT_SUCCESS',
        title: 'Payment Successful',
        message: `Your payment of $${receipt.total.toFixed(2)} has been processed successfully.`,
        data: {
          receiptId,
          sessionId,
          paymentId: mockPaymentId,
          total: receipt.total,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        paymentId: mockPaymentId,
        paymentUrl,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
