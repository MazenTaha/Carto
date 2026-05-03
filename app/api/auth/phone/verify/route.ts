import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseIdToken } from '@/lib/firebase/admin';
import { normalizeEgyptianMobileNumber } from '@/lib/phone';
import { phoneAuthVerifySchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = phoneAuthVerifySchema.parse(body);
    const decodedToken = await verifyFirebaseIdToken(idToken);
    const phoneNumber = normalizeEgyptianMobileNumber(decodedToken.phone_number || '');

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Invalid phone verification' },
        { status: 400 }
      );
    }

    const user = await prisma.user.upsert({
      where: { phoneNumber },
      update: {},
      create: {
        phoneNumber,
        name: 'Phone Shopper',
      },
      select: {
        id: true,
        phoneNumber: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid phone verification' },
        { status: 400 }
      );
    }

    console.error('Phone verification error:', error);
    return NextResponse.json(
      { error: 'Invalid phone verification' },
      { status: 401 }
    );
  }
}
