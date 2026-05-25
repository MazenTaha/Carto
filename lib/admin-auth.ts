import { getServerSession } from 'next-auth/next';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth-config';
import { errorResponse } from '@/lib/api-response';
import { isAdminEmail } from '@/lib/admin-emails';

export { isAdminEmail };

export async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return null;
  }

  return session;
}

export async function guardAdminApi(
  _req: NextRequest
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  }

  if (!isAdminEmail(session.user.email)) {
    return errorResponse('Forbidden - admin access only', 403, 'FORBIDDEN');
  }

  return null;
}
