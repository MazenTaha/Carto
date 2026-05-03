// NextAuth configuration

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { verifyPassword } from './auth';
import { normalizeEgyptianMobileNumber } from './phone';
import { phoneAuthVerifySchema, signInSchema } from './validations';
import { verifyFirebaseIdToken } from './firebase/admin';

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
          throw new Error('Invalid email or password');
        }

        if (!process.env.DATABASE_URL) {
          throw new Error('Invalid email or password');
        }

        try {
          const { prisma } = await import('./prisma');
          const user = await prisma.user.findUnique({
            where: { email: parsed.data.email },
          });

          if (!user?.password) {
            throw new Error('Invalid email or password');
          }

          const isValid = await verifyPassword(parsed.data.password, user.password);

          if (!isValid) {
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
        }

        return token;
      }

      if (user) {
        token.id = user.id;
        token.email = user.email ?? null;
        token.name = user.name;
        token.phoneNumber = user.phoneNumber;
        token.image = user.image;
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
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'development-secret-change-in-production',
};

