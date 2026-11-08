// Fact generation with a 60-second cache, burst protection and a fallback.
//
// For each user + movie:
//   - a fact less than 60s old is reused ("cached")
//   - otherwise a new one is generated, stored and returned ("new")
//   - if OpenAI fails, the most recent stored fact is returned ("stale")
//
// Burst protection: everything happens inside a transaction that first takes a
// Postgres advisory lock for this user. Concurrent requests for the same user
// (fast refreshes, several tabs) queue up behind it; when the next one gets
// the lock it finds the fact the previous one just saved and reuses it, so
// only one OpenAI call is made.
import "server-only";
import { prisma } from "@/lib/db";
import { generateFact } from "@/lib/openai";

export const CACHE_WINDOW_MS = 60_000;

// OpenAI gives up after 10s. A request that waited for the lock may need its
// own OpenAI call too (if the first one failed), so allow two of those plus
// some margin before the transaction is abandoned.
const TRANSACTION_TIMEOUT_MS = 25_000;

// How many of the user's recent facts we ask OpenAI not to repeat. Small and
// fixed, so requests never grow with history.
const RECENT_FACTS_TO_AVOID = 5;

type StoredFact = { text: string; createdAt: Date };

export type FactResult =
  | { status: "new" | "cached" | "stale"; text: string; createdAt: Date; ageSeconds: number }
  | { status: "unknown" } // the model doesn't know this film, and we have nothing stored
  | { status: "error" }; // nothing to show at all

// `userId` must come from the session, never from the request: that is what
// stops a user from reading someone else's facts.
// `now` is passed in (instead of reading the clock in several places) so the
// whole call uses one clock, and tests can control time.
export async function getFact(userId: string, now: Date = new Date()): Promise<FactResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { favoriteMovie: true },
  });
  const movie = user?.favoriteMovie;
  if (!movie) return { status: "error" };

  const withAge = (status: "new" | "cached" | "stale", fact: StoredFact): FactResult => ({
    status,
    ...fact,
    // max(0, ...): a request that waited for the lock may see a fact saved a
    // moment after its own `now`
    ageSeconds: Math.max(0, Math.floor((now.getTime() - fact.createdAt.getTime()) / 1000)),
  });

  try {
    return await prisma.$transaction(
      async (tx) => {
        // One request per user at a time. Released automatically when the
        // transaction commits or rolls back, even if the server crashes.
        // ($executeRaw, not $queryRaw: the function returns `void`, which
        // Prisma can't turn into a value.)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

        // Checked only after getting the lock, so we see facts saved by a
        // request that was ahead of us in the queue. The newest decides the
        // cache; all of them are sent to OpenAI so it avoids repeating them.
        const recent = await tx.fact.findMany({
          where: { userId, movie },
          orderBy: { createdAt: "desc" },
          take: RECENT_FACTS_TO_AVOID,
          select: { text: true, createdAt: true },
        });
        const latest = recent[0];

        if (latest && now.getTime() - latest.createdAt.getTime() < CACHE_WINDOW_MS) {
          return withAge("cached", latest);
        }

        let text: string | null;
        try {
          text = await generateFact(
            movie,
            recent.map((fact) => fact.text),
          );
        } catch (error) {
          console.error("OpenAI fact generation failed", error);
          return latest ? withAge("stale", latest) : { status: "error" };
        }

        // The model doesn't know the film: never store that as a fact.
        if (text === null) {
          return latest ? withAge("stale", latest) : { status: "unknown" };
        }

        const created = await tx.fact.create({
          data: { userId, movie, text, createdAt: now },
          select: { text: true, createdAt: true },
        });
        return withAge("new", created);
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  } catch (error) {
    // The transaction itself failed (timed out, lost the DB connection...).
    // Last resort: show the most recent stored fact, read outside the lock.
    console.error("Fact transaction failed", error);
    const latest = await prisma.fact
      .findFirst({
        where: { userId, movie },
        orderBy: { createdAt: "desc" },
        select: { text: true, createdAt: true },
      })
      .catch(() => null);
    return latest ? withAge("stale", latest) : { status: "error" };
  }
}
