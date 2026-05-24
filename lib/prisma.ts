// Prisma Client singleton for Next.js
// Prevents multiple instances in development
// Only initializes if DATABASE_URL is configured

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let prismaInstance: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  // Don't initialize if DATABASE_URL is not set.
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Database features are disabled.');
  }

  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  if (!prismaInstance) {
    try {
      prismaInstance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });
      
      if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.prisma = prismaInstance;
      }
    } catch (error: any) {
      if (error.message?.includes('Prisma Client')) {
        throw new Error('Prisma Client not generated. Run: npx prisma generate');
      }
      throw error;
    }
  }

  return prismaInstance;
}

// Export a proxy that only initializes when actually used
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return getPrisma()[prop as keyof PrismaClient];
  },
});

