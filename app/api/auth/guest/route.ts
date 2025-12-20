// Guest authentication API route - creates a temporary guest session
// Note: This route requires a database. For guest mode without database, use /api/auth/guest-bypass

import { NextRequest, NextResponse } from 'next/server';

// POST /api/auth/guest - Create or get guest user
export async function POST(request: NextRequest) {
  // If database is not configured, return error
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        error: 'Database is not configured. Guest mode bypass is available without database.',
        useBypass: true
      },
      { status: 503 }
    );
  }

  try {
    // Lazy import to avoid loading if database is not configured
    const { prisma } = await import('@/lib/prisma');
    const { hashPassword } = await import('@/lib/auth');

    // Check if guest user already exists
    const guestEmail = 'guest@carto.local';
    let guestUser = await prisma.user.findUnique({
      where: { email: guestEmail },
    });

    // Create guest user if it doesn't exist
    if (!guestUser) {
      const hashedPassword = await hashPassword('guest123');
      guestUser = await prisma.user.create({
        data: {
          email: guestEmail,
          password: hashedPassword,
          name: 'Guest User',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        email: guestUser.email,
        password: 'guest123', // Return password for sign-in
      },
    });
  } catch (error: any) {
    console.error('Error creating guest user:', error);
    return NextResponse.json(
      {
        error: 'Failed to create guest session',
        details: error.message
      },
      { status: 500 }
    );
  }
}

