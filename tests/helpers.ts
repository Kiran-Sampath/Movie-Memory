import { prisma } from "@/lib/db";
import { assertTestDatabase } from "./global-setup";

// Empties every table. Called before each test so tests can't affect each other.
export async function resetDatabase() {
  assertTestDatabase(process.env.DATABASE_URL!);
  await prisma.$executeRaw`TRUNCATE "Fact", "Session", "Account", "User" CASCADE`;
}

export function createUser(name: string, favoriteMovie: string | null) {
  return prisma.user.create({
    data: { name, email: `${name.toLowerCase()}@example.com`, favoriteMovie },
  });
}

export function createFact(userId: string, movie: string, text: string, createdAt: Date) {
  return prisma.fact.create({ data: { userId, movie, text, createdAt } });
}

// `base` plus a number of seconds, for building timelines.
export function secondsAfter(base: Date, seconds: number): Date {
  return new Date(base.getTime() + seconds * 1000);
}
