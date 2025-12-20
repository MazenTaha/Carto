// Add items to receipt API route (simulates cart scanning)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const addItemSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  quantity: z.number().int().positive().default(1),
  category: z.string().optional(),
});

// POST /api/receipts/[id]/items - Add item to receipt (simulates cart scanning)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify receipt ownership
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    if (receipt.status === 'LOCKED' || receipt.status === 'PAID') {
      return NextResponse.json(
        { error: 'Receipt is locked or paid' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = addItemSchema.parse(body);

    // Check if item already exists
    const existingItem = await prisma.receiptItem.findFirst({
      where: {
        receiptId: params.id,
        name: validatedData.name,
      },
    });

    let item;
    if (existingItem) {
      // Update quantity if item exists
      item = await prisma.receiptItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + validatedData.quantity,
        },
      });
    } else {
      // Create new item
      item = await prisma.receiptItem.create({
        data: {
          ...validatedData,
          receiptId: params.id,
        },
      });
    }

    // Update receipt totals
    const allItems = await prisma.receiptItem.findMany({
      where: { receiptId: params.id },
    });

    const subtotal = allItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const tax = subtotal * 0.085; // 8.5% tax
    const total = subtotal + tax;

    await prisma.receipt.update({
      where: { id: params.id },
      data: {
        subtotal,
        tax,
        total,
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error adding receipt item:', error);
    return NextResponse.json(
      { error: 'Failed to add item' },
      { status: 500 }
    );
  }
}

