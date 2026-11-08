import { prisma } from "@/lib/db";
import { generateFact } from "@/lib/openai";

type FunFactProps = { userId: string; movie: string };

// Base version (step 5): a new fact on every page load, saved to the database.
// Step 6 replaces the body with the cached, lock-protected getFact().
export async function FunFact({ userId, movie }: FunFactProps) {
  const text = await newFact(userId, movie);

  if (!text) {
    return (
      <p className="text-muted">
        We couldn&apos;t come up with a fact right now. Try refreshing in a moment.
      </p>
    );
  }
  return <p className="text-lg leading-relaxed">{text}</p>;
}

// Generates and stores a fact. Returns null if OpenAI (or the save) fails.
async function newFact(userId: string, movie: string): Promise<string | null> {
  try {
    const text = await generateFact(movie);
    await prisma.fact.create({ data: { userId, movie, text } });
    return text;
  } catch (error) {
    console.error("Fact generation failed", error);
    return null;
  }
}

export function FunFactLoading() {
  return <p className="animate-pulse text-muted">Digging up a fun fact…</p>;
}
