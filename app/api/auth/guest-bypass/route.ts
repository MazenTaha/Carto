// Simple guest bypass - works without database

import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/guest-bypass - Simple bypass that sets a cookie
export async function GET(request: NextRequest) {
  const response = NextResponse.json({ success: true, bypass: true });
  
  // Set a simple guest cookie
  response.cookies.set('guest_mode', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}

