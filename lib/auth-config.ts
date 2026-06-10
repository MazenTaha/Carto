// NextAuth configuration

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { hashPassword, verifyPassword } from './auth';
import { normalizeEgyptianMobileNumber } from './phone';
import { phoneAuthVerifySchema, signInSchema } from './validations';
import { verifyFirebaseIdToken } from './firebase/admin';
import { getPrismaConnectivityMessage } from './prisma-errors';
import { isAdminEmail } from './admin-emails';
import { getAuthSecret } from './auth-secret';

const SEEDED_ADMIN_EMAIL = 'admin@gmail.com';
const SEEDED_ADMIN_PASSWORD = 'Admin_1';
const authSecret = getAuthSecret();
const canUseSeededAdmin = process.env.NODE_ENV !== 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

function isSeededAdminCredentials(email: string, password: string) {
  return canUseSeededAdmin && email === SEEDED_ADMIN_EMAIL && password === SEEDED_ADMIN_PASSWORD;
}

function logCredentialsFailure(reason: string) {
  if (isDevelopment) {
    console.warn(`[auth] Credentials login rejected: ${reason}`);
  }
}

const googleProviders = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    ]
  : [];

export const authOptions: NextAuthOptions = {
  providers: [
    ...googleProviders,
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);

        if (!parsed.success) {
          logCredentialsFailure('invalid_signin_payload');
          throw new Error('Invalid email or password');
        }

        if (!process.env.DATABASE_URL) {
          logCredentialsFailure('database_url_missing');
          throw new Error('DATABASE_UNAVAILABLE');
        }

        try {
          const { prisma } = await import('./prisma');
          let user = await prisma.user.findUnique({
            where: { email: parsed.data.email },
          });

          // Keep the local seeded admin login working even after DB resets or
          // partial seeds. This avoids a confusing "invalid password" loop in dev.
          if (!user && isSeededAdminCredentials(parsed.data.email, parsed.data.password)) {
            const password = await hashPassword(SEEDED_ADMIN_PASSWORD);
            user = await prisma.user.create({
              data: {
                email: SEEDED_ADMIN_EMAIL,
                password,
                name: 'Admin',
              },
            });
          }

          if (!user) {
            logCredentialsFailure(`user_not_found:${parsed.data.email}`);
            throw new Error('Invalid email or password');
          }

          if (!user?.password) {
            logCredentialsFailure(`password_hash_missing:${user.id}`);
            throw new Error('Invalid email or password');
          }

          let isValid = await verifyPassword(parsed.data.password, user.password);

          if (!isValid && isSeededAdminCredentials(parsed.data.email, parsed.data.password)) {
            const password = await hashPassword(SEEDED_ADMIN_PASSWORD);
            user = await prisma.user.update({
              where: { id: user.id },
              data: { password, name: user.name || 'Admin' },
            });
            isValid = await verifyPassword(parsed.data.password, user.password as string);
          }

          if (!isValid) {
            logCredentialsFailure(`bcrypt_compare_failed:${user.id}`);
            throw new Error('Invalid email or password');
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            phoneNumber: user.phoneNumber,
            image: user.image,
          };
        } catch (error: any) {
          const databaseMessage = getPrismaConnectivityMessage(error);
          if (databaseMessage) {
            logCredentialsFailure('database_error');
            if (isDevelopment) {
              console.warn('[auth] Credentials login database issue:', databaseMessage);
            }
            throw new Error('DATABASE_UNAVAILABLE');
          }

          if (isDevelopment && error instanceof Error && error.message !== 'Invalid email or password') {
            console.warn('[auth] Unexpected credentials authorize error:', error.message);
          }

          throw new Error('Invalid email or password');
        }
      },
    }),
    CredentialsProvider({
      id: 'phone-otp',
      name: 'Phone OTP',
      credentials: {
        idToken: { label: 'Firebase ID Token', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = phoneAuthVerifySchema.safeParse({ idToken: credentials?.idToken });

        if (!parsed.success || !process.env.DATABASE_URL) {
          throw new Error('Invalid phone verification');
        }

        try {
          const decodedToken = await verifyFirebaseIdToken(parsed.data.idToken);
          const phoneNumber = normalizeEgyptianMobileNumber(decodedToken.phone_number || '');

          if (!phoneNumber) {
            throw new Error('Invalid phone verification');
          }

          const { prisma } = await import('./prisma');
          const user = await prisma.user.upsert({
            where: { phoneNumber },
            update: {},
            create: {
              phoneNumber,
              name: 'Phone Shopper',
            },
            select: {
              id: true,
              email: true,
              name: true,
              phoneNumber: true,
              image: true,
            },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            phoneNumber: user.phoneNumber,
            image: user.image,
          };
        } catch (error) {
          throw new Error('Invalid phone verification');
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // NextAuth stores this session in browser cookies for 30 days.
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        const googleProfile = profile as { email?: string; email_verified?: boolean } | undefined;
        return Boolean(process.env.DATABASE_URL && googleProfile?.email && googleProfile.email_verified !== false);
      }

      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === 'google') {
        const googleProfile = profile as { email?: string; name?: string; picture?: string } | undefined;
        const email = (user?.email || googleProfile?.email || '').toLowerCase();

        if (email) {
          const { prisma } = await import('./prisma');
          const dbUser = await prisma.user.upsert({
            where: { email },
            update: {
              name: user?.name || googleProfile?.name || undefined,
              image: (user as any)?.image || googleProfile?.picture || undefined,
            },
            create: {
              email,
              name: user?.name || googleProfile?.name || null,
              image: (user as any)?.image || googleProfile?.picture || null,
            },
            select: {
              id: true,
              email: true,
              name: true,
              phoneNumber: true,
              image: true,
            },
          });

          token.id = dbUser.id;
          token.email = dbUser.email;
          token.name = dbUser.name;
          token.phoneNumber = dbUser.phoneNumber;
          token.image = dbUser.image;
          token.role = isAdminEmail(dbUser.email) ? 'ADMIN' : 'USER';
          token.provider = 'google';
        }

        return token;
      }

      if (user) {
        token.id = user.id;
        token.email = user.email ?? null;
        token.name = user.name;
        token.phoneNumber = user.phoneNumber;
        token.image = user.image;
        token.role = isAdminEmail(user.email ?? null) ? 'ADMIN' : 'USER';
        token.provider = account?.provider ?? token.provider ?? null;
      } else if (!token.role) {
        token.role = isAdminEmail((token.email as string | null | undefined) ?? null) ? 'ADMIN' : 'USER';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = (token.email as string | null | undefined) ?? null;
        session.user.name = token.name as string | null;
        session.user.phoneNumber = token.phoneNumber as string | null | undefined;
        session.user.image = token.image as string | null | undefined;
        session.user.role = (token.role as 'ADMIN' | 'USER' | undefined) ?? 'USER';
        session.user.provider = (token.provider as string | null | undefined) ?? null;
      }
      return session;
    },
  },
  secret: authSecret,
};

