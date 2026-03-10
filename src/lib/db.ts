import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export async function getPrisma(): Promise<PrismaClient> {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
    const mod = await import("@/generated/prisma/client");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = mod.PrismaClient as any;
    globalForPrisma.prisma = new Ctor({ adapter });
  }
  return globalForPrisma.prisma!;
}
