// Receipt item API routes

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateItemSchema = z.object({
  quantity: z.number().int().positive().optional(),
});

// PUT /api/receipts/[id]/items/[itemId] - Update receipt item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
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

    if (receipt.status === 'LOCKED') {
      return NextResponse.json(
        { error: 'Receipt is locked' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updateItemSchema.parse(body);

    const item = await prisma.receiptItem.update({
      where: { id: params.itemId },
      data: validatedData,
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    console.error('Error updating receipt item:', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

// DELETE /api/receipts/[id]/items/[itemId] - Remove receipt item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
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

    if (receipt.status === 'LOCKED') {
      return NextResponse.json(
        { error: 'Receipt is locked' },
        { status: 400 }
      );
    }

    await prisma.receiptItem.delete({
      where: { id: params.itemId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    console.error('Error deleting receipt item:', error);
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}

