import { CACHE_WINDOW_MS, getFact } from "@/lib/facts";

const CACHE_WINDOW_SECONDS = CACHE_WINDOW_MS / 1000;

// Server component: all the caching, locking and fallback logic lives in
// getFact(); this only decides what to show for each outcome.
export async function FunFact({ userId }: { userId: string }) {
  const result = await getFact(userId);

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

  return (
    <div>
      <p className="text-lg leading-relaxed">{result.text}</p>
      <p className="mt-3 text-xs text-muted">{statusLine(result.status, result.ageSeconds)}</p>
    </div>
  );
}

function statusLine(status: "new" | "cached" | "stale", ageSeconds: number): string {
  if (status === "new") return "Fresh fact";
  if (status === "stale") return "Couldn't get a new fact, so here's your last one";

  const nextIn = Math.max(1, CACHE_WINDOW_SECONDS - ageSeconds);
  return `Generated ${ageSeconds}s ago · a new one in ${nextIn}s`;
}

export function FunFactLoading() {
  return <p className="animate-pulse text-muted">Digging up a fun fact…</p>;
}
