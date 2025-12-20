// Sessions API routes

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET /api/sessions - Get all user sessions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cartSessions = await prisma.cartSession.findMany({
      where: { userId: session.user.id },
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

    return NextResponse.json({ success: true, data: cartSessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

