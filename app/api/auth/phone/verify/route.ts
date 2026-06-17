import { NextRequest } from 'next/server';

export const runtime = "nodejs";
import { prisma } from '@/lib/prisma';
import { verifyFirebaseIdToken } from '@/lib/firebase/admin';
import { normalizeEgyptianMobileNumber } from '@/lib/phone';
import { phoneAuthVerifySchema } from '@/lib/validations';
import { noStoreErrorResponse, noStoreSuccessResponse } from '@/lib/http-cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function readPhoneVerifyError(error: any) {
  const message = String(error?.message || '');

  if (message.includes('Firebase Admin environment variables are not configured')) {
    return { code: 'FIREBASE_ADMIN_NOT_CONFIGURED', message: 'Phone login is not configured on the server yet.' };
  }

  if (message.includes('argument-error') || message.includes('Firebase ID token')) {
    return { code: 'INVALID_PHONE_VERIFICATION', message: 'Invalid phone verification. Please request a new code and try again.' };
  }

  return { code: 'PHONE_VERIFICATION_FAILED', message: 'Could not verify that phone number.' };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = phoneAuthVerifySchema.parse(body);
    const decodedToken = await verifyFirebaseIdToken(idToken);
    const phoneNumber = normalizeEgyptianMobileNumber(decodedToken.phone_number || '');

    if (!phoneNumber) {
      return noStoreErrorResponse('Invalid phone verification. Please request a new code and try again.', 400, 'INVALID_PHONE_VERIFICATION');
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

    return noStoreSuccessResponse({
      userId: user.id,
      phoneNumber: user.phoneNumber,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return noStoreErrorResponse('Invalid phone verification. Please request a new code and try again.', 400, 'VALIDATION_ERROR');
    }

    console.error('Phone verification error:', error);
    const authError = readPhoneVerifyError(error);
    return noStoreErrorResponse(authError.message, 401, authError.code);
  }
}
