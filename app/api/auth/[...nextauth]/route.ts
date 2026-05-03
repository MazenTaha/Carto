// NextAuth API route handler

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth-config';

// Provide a default secret for development.
if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = 'development-secret-change-in-production';
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

