// QR code generation API route

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import QRCode from 'qrcode';

// GET /api/cart/qrcode?listId=xxx - Generate QR code for cart linking
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('listId');

    if (!listId) {
      return NextResponse.json({ error: 'List ID is required' }, { status: 400 });
    }

    // Verify list ownership
    const { prisma } = await import('@/lib/prisma');
    const list = await prisma.shoppingList.findFirst({
      where: {
        id: listId,
        userId: session.user.id,
      },
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    // Generate QR code data (contains listId and userId for verification)
    const qrData = JSON.stringify({
      listId,
      userId: session.user.id,
      timestamp: Date.now(),
    });

    // Generate QR code as data URL (for image display)
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
    });

    return NextResponse.json({
      success: true,
      data: {
        qrCode: qrCodeDataUrl,
        qrData: qrData, // Raw data for QRCodeSVG component
        listId,
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}

