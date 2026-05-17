// Admin authentication helpers
// Uses ADMIN_EMAILS env var (comma-separated list) to gate admin access.
// No schema migration needed — just add emails to .env

import { isAdminEmail } from '@/lib/admin-emails';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';
import { NextRequest, NextResponse } from 'next/server';

export { isAdminEmail };


/**
 * Server-side admin guard for use in Server Components / page.tsx.
 * Returns the session if the user is an admin, null otherwise.
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return null;
  }
  return session;
}

/**
 * API route guard — returns 401/403 JSON response if not admin.
 * Returns null if the user IS an admin (proceed normally).
 */
export async function guardAdminApi(
  _req: NextRequest
): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden — admin access only' },
      { status: 403 }
    );
  }

  return null; // Caller should proceed
}
