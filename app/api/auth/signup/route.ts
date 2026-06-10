// Sign up API route

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { signUpSchema } from '@/lib/validations';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getPrismaConnectivityMessage } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = signUpSchema.parse(body);
    const email = validatedData.email;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return errorResponse('An account with that email already exists.', 409, 'EMAIL_IN_USE');
    }

    const hashedPassword = await hashPassword(validatedData.password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: validatedData.name || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return successResponse(user, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0]?.message || 'Invalid signup details', 400, 'VALIDATION_ERROR');
    }

    if (error?.code === 'P2002') {
      return errorResponse('An account with that email already exists.', 409, 'EMAIL_IN_USE');
    }

    const databaseMessage = getPrismaConnectivityMessage(error);
    if (databaseMessage) {
      return errorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE');
    }

    console.error('Signup error:', error);
    return errorResponse('Unable to create account with these details', 500, 'SIGNUP_FAILED');
  }
}

