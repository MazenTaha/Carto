// Prisma Client singleton for Next.js
// Prevents multiple instances in development
// Only initializes if DATABASE_URL is configured

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

let prismaInstance: any = null;

function getPrisma() {
  // Don't initialize if DATABASE_URL is not set (guest mode)
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Database features are disabled in guest mode.');
  }

  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  if (!prismaInstance) {
    try {
      const { PrismaClient } = require('@prisma/client');
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
export const prisma = new Proxy({} as any, {
  get(_target, prop) {
    return getPrisma()[prop];
  },
});

