import { NextRequest, NextResponse } from 'next/server';

export const runtime = "nodejs";
import { prisma } from '@/lib/prisma';
import { purgeExpiredShoppingLists } from '@/lib/list-retention';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerFilter = ownerWhere(owner);
    await purgeExpiredShoppingLists(prisma, ownerFilter);

    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        ...ownerFilter,
        deletedAt: { not: null },
      },
      select: { id: true },
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const recoveredList = await prisma.shoppingList.update({
      where: { id: params.id },
      data: {
        deletedAt: null,
        permanentDeleteAt: null,
      },
      select: {
        id: true,
        name: true,
        userId: true,
        guestSessionId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: recoveredList });
  } catch (error) {
    console.error('Error recovering list:', error);
    return NextResponse.json(
      { error: 'Failed to recover list' },
      { status: 500 }
    );
  }
}
