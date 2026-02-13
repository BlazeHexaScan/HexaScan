import { PrismaClient } from '@prisma/client';

// Prisma client singleton
let prisma: PrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
} else {
  // In development, use a global variable to preserve the client across hot reloads
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  prisma = global.__prisma;
}

// Handle connection errors gracefully
prisma.$connect().catch((err) => {
  console.error('Failed to connect to database:', err);
});

export { prisma };

// Helper function to gracefully disconnect
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
