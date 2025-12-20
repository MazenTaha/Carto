// Payment creation API route

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// POST /api/payment/create - Create payment session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { receiptId, sessionId, amount } = body;

    // Verify receipt ownership
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        userId: session.user.id,
        status: 'LOCKED',
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    // In a real implementation, you would integrate with Stripe here
    // For now, we'll simulate payment processing
    
    // Check if Stripe is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (stripeSecretKey && stripeSecretKey.startsWith('sk_')) {
      // Real Stripe integration would go here
      // const stripe = require('stripe')(stripeSecretKey);
      // const paymentIntent = await stripe.paymentIntents.create({...});
      
      // For now, we'll use mock payment
      const mockPaymentId = `pi_mock_${Date.now()}`;
      
      // Update receipt with payment ID
      await prisma.receipt.update({
        where: { id: receiptId },
        data: {
          paymentId: mockPaymentId,
          status: 'PAID',
        },
      });

      // Update session status
      await prisma.cartSession.update({
        where: { id: sessionId },
        data: {
          status: 'CHECKED_OUT',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          paymentId: mockPaymentId,
          paymentUrl: null, // In real implementation, this would be the Stripe checkout URL
        },
      });
    } else {
      // Mock payment for development
      const mockPaymentId = `pi_mock_${Date.now()}`;
      
      await prisma.receipt.update({
        where: { id: receiptId },
        data: {
          paymentId: mockPaymentId,
          status: 'PAID',
        },
      });

      await prisma.cartSession.update({
        where: { id: sessionId },
        data: {
          status: 'CHECKED_OUT',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          paymentId: mockPaymentId,
          paymentUrl: null,
        },
      });
    }
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}

