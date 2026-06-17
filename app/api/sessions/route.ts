// Sessions API routes

import { NextRequest, NextResponse } from 'next/server';
import { withNoStoreHeaders } from '@/lib/http-cache';
import { prisma } from '@/lib/prisma';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';

export const runtime = "nodejs";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/sessions - Get all user sessions
export async function GET(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return withNoStoreHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const cartSessions = await prisma.cartSession.findMany({
      where: ownerWhere(owner),
      include: {
        shoppingList: {
          include: { items: true },
        },
        receipt: {
          include: { items: true },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return withNoStoreHeaders(NextResponse.json({ success: true, data: cartSessions }));
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return withNoStoreHeaders(
      NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    );
  }
}

