// Payment creation API route

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { createPaymentSchema } from '@/lib/validations';

// POST /api/payment/create - Create payment session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { receiptId, sessionId, amount, paymentMethod } = createPaymentSchema.parse(body);

    // Verify receipt ownership
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        userId: session.user.id,
        status: 'LOCKED',
      },
      include: { items: true },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
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
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        paymentId: mockPaymentId,
        status: 'PAID',
        paymentStatus: 'COMPLETED',
      },
    });

    await prisma.cartSession.update({
      where: { id: sessionId },
      data: {
        status: 'CHECKED_OUT',
        endedAt: new Date(),
      },
    });

    // Release the physical cart back to AVAILABLE
    const cartSession = await prisma.cartSession.findUnique({
      where: { id: sessionId },
      select: { cartId: true },
    });

    if (cartSession) {
      await prisma.cart.update({
        where: { id: cartSession.cartId },
        data: { status: 'AVAILABLE' },
      }).catch(() => { /* Cart may not exist in Cart model if legacy session */ });
    }

    // ─── Update User Stats ───────────────────────────────────────────────────
    const currentStats = await prisma.userStats.findUnique({
      where: { userId: session.user.id },
    });

    const newTotalOrders = (currentStats?.totalOrders || 0) + 1;
    const newTotalSpent = (currentStats?.totalSpent || 0) + receipt.total;
    const newAverage = newTotalSpent / newTotalOrders;

    await prisma.userStats.upsert({
      where: { userId: session.user.id },
      update: {
        totalOrders: newTotalOrders,
        totalSpent: newTotalSpent,
        averageBasketValue: newAverage,
      },
      create: {
        userId: session.user.id,
        totalOrders: 1,
        totalSpent: receipt.total,
        averageBasketValue: receipt.total,
      },
    });

    // ─── Track Favorite Products ─────────────────────────────────────────────
    for (const item of receipt.items) {
      // Try to find matching product by name
      const product = await prisma.product.findFirst({
        where: { name: { equals: item.name, mode: 'insensitive' } },
      });

      if (product) {
        await prisma.userFavoriteProduct.upsert({
          where: {
            userId_productId: {
              userId: session.user.id,
              productId: product.id,
            },
          },
          update: {
            purchaseCount: { increment: item.quantity },
            lastPurchased: new Date(),
          },
          create: {
            userId: session.user.id,
            productId: product.id,
            purchaseCount: item.quantity,
          },
        });
      }
    }

    // ─── Create Notification ─────────────────────────────────────────────────
    await prisma.notification.create({
      data: {
        userId: session.user.id,
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
