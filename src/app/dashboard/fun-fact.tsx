import { prisma } from "@/lib/db";
import { generateFact } from "@/lib/openai";

type FunFactProps = { userId: string; movie: string };

type FactResult =
  | { status: "ok"; text: string }
  | { status: "unknown" } // the model doesn't know this film
  | { status: "error" }; // OpenAI or the database failed

// Base version (step 5): a new fact on every page load, saved to the database.
// Step 6 replaces the body with the cached, lock-protected getFact().
export async function FunFact({ userId, movie }: FunFactProps) {
  const result = await newFact(userId, movie);

  if (result.status === "unknown") {
    return (
      <p className="text-muted">
        We don&apos;t know enough about this film to share a fact yet. It may be
        too new.
      </p>
    );
  }
  if (result.status === "error") {
    return (
      <p className="text-muted">
        We couldn&apos;t come up with a fact right now. Try refreshing in a moment.
      </p>
    );
  }
  return <p className="text-lg leading-relaxed">{result.text}</p>;
}

// Generates a fact and stores it. "Unknown" replies are not stored.
async function newFact(userId: string, movie: string): Promise<FactResult> {
  try {
    const text = await generateFact(movie);
    if (text === null) return { status: "unknown" };

    await prisma.fact.create({ data: { userId, movie, text } });
    return { status: "ok", text };
  } catch (error) {
    console.error("Fact generation failed", error);
    return { status: "error" };
  }
}

export function FunFactLoading() {
  return <p className="animate-pulse text-muted">Digging up a fun fact…</p>;
}
