import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { getFact } from "@/lib/facts";
import { generateFact } from "@/lib/openai";
import { createFact, createUser, resetDatabase, secondsAfter } from "./helpers";

// Never call the real OpenAI in tests: each test decides what it returns.
vi.mock("@/lib/openai", () => ({ generateFact: vi.fn() }));
const mockGenerateFact = vi.mocked(generateFact);

const MOVIE = "The Matrix (1999)";
const T0 = new Date("2026-01-01T12:00:00Z");

function countFacts(userId: string) {
  return prisma.fact.count({ where: { userId } });
}

beforeEach(async () => {
  await resetDatabase();
  mockGenerateFact.mockReset();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("60-second cache", () => {
  it("generates and stores a fact when the user has none", async () => {
    const user = await createUser("Ada", MOVIE);
    mockGenerateFact.mockResolvedValue("Fact one");

    const result = await getFact(user.id, T0);

    expect(result).toMatchObject({ status: "new", text: "Fact one", ageSeconds: 0 });
    expect(mockGenerateFact).toHaveBeenCalledTimes(1);
    expect(await countFacts(user.id)).toBe(1);
  });

  it("reuses a fact that is less than 60 seconds old", async () => {
    const user = await createUser("Ada", MOVIE);
    await createFact(user.id, MOVIE, "Cached fact", T0);

    const result = await getFact(user.id, secondsAfter(T0, 59.9));

    expect(result).toMatchObject({ status: "cached", text: "Cached fact", ageSeconds: 59 });
    expect(mockGenerateFact).not.toHaveBeenCalled();
    expect(await countFacts(user.id)).toBe(1);
  });

  it("generates a new fact once the latest is 60 seconds old", async () => {
    const user = await createUser("Ada", MOVIE);
    await createFact(user.id, MOVIE, "Old fact", T0);
    mockGenerateFact.mockResolvedValue("New fact");

    const now = secondsAfter(T0, 60);
    const result = await getFact(user.id, now);

    expect(result).toMatchObject({ status: "new", text: "New fact" });
    expect(await countFacts(user.id)).toBe(2);
    // stored with the same clock the check used
    const newest = await prisma.fact.findFirst({ orderBy: { createdAt: "desc" } });
    expect(newest?.createdAt).toEqual(now);
  });

  it("sends the user's recent facts (newest first) so they aren't repeated", async () => {
    const user = await createUser("Ada", MOVIE);
    await createFact(user.id, MOVIE, "Older", T0);
    await createFact(user.id, MOVIE, "Newer", secondsAfter(T0, 10));
    mockGenerateFact.mockResolvedValue("Newest");

    await getFact(user.id, secondsAfter(T0, 120));

    expect(mockGenerateFact).toHaveBeenCalledWith(MOVIE, ["Newer", "Older"]);
  });

  it("treats a changed movie as having no cached fact", async () => {
    const user = await createUser("Ada", "Dune (2021)");
    await createFact(user.id, MOVIE, "Fact about the previous movie", T0);
    mockGenerateFact.mockResolvedValue("Dune fact");

    const result = await getFact(user.id, secondsAfter(T0, 5));

    expect(result).toMatchObject({ status: "new", text: "Dune fact" });
    expect(mockGenerateFact).toHaveBeenCalledWith("Dune (2021)", []);
  });
});

describe("burst protection", () => {
  it("makes one OpenAI call when two requests arrive at the same time", async () => {
    const user = await createUser("Ada", MOVIE);
    // A slow OpenAI, so the second request arrives while the first is waiting.
    mockGenerateFact.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve("Only fact"), 200)),
    );

    const [first, second] = await Promise.all([
      getFact(user.id, T0),
      getFact(user.id, T0),
    ]);

    expect(mockGenerateFact).toHaveBeenCalledTimes(1);
    expect(await countFacts(user.id)).toBe(1);
    // one generated it, the other waited for the lock and reused it
    expect([first.status, second.status].sort()).toEqual(["cached", "new"]);
    expect(first).toMatchObject({ text: "Only fact" });
    expect(second).toMatchObject({ text: "Only fact" });
  });

  it("does not make different users wait for each other's facts", async () => {
    const ada = await createUser("Ada", MOVIE);
    const bob = await createUser("Bob", MOVIE);
    mockGenerateFact.mockImplementation(
      (movie) => new Promise((resolve) => setTimeout(() => resolve(`Fact for ${movie}`), 200)),
    );

    const started = Date.now();
    await Promise.all([getFact(ada.id, T0), getFact(bob.id, T0)]);

    // each user gets their own fact, generated in parallel (not 2 x 200ms)
    expect(mockGenerateFact).toHaveBeenCalledTimes(2);
    expect(Date.now() - started).toBeLessThan(400);
  });
});

describe("OpenAI failures", () => {
  it("returns the most recent stored fact when OpenAI fails", async () => {
    const user = await createUser("Ada", MOVIE);
    await createFact(user.id, MOVIE, "Last good fact", T0);
    mockGenerateFact.mockRejectedValue(new Error("timeout"));

    const result = await getFact(user.id, secondsAfter(T0, 120));

    expect(result).toMatchObject({ status: "stale", text: "Last good fact" });
    expect(await countFacts(user.id)).toBe(1); // nothing new stored
  });

  it("returns an error status when OpenAI fails and there is no fact", async () => {
    const user = await createUser("Ada", MOVIE);
    mockGenerateFact.mockRejectedValue(new Error("500 from OpenAI"));

    const result = await getFact(user.id, T0);

    expect(result).toEqual({ status: "error" });
    expect(await countFacts(user.id)).toBe(0);
  });

  it("does not store anything when the model doesn't know the film", async () => {
    const user = await createUser("Ada", "The Odyssey (2026)");
    mockGenerateFact.mockResolvedValue(null);

    const result = await getFact(user.id, T0);

    expect(result).toEqual({ status: "unknown" });
    expect(await countFacts(user.id)).toBe(0);
  });
});

describe("authorization", () => {
  it("never returns another user's fact, even for the same movie", async () => {
    const ada = await createUser("Ada", MOVIE);
    const bob = await createUser("Bob", MOVIE);
    // Bob has a fresh fact for the same movie...
    await createFact(bob.id, MOVIE, "Bob's private fact", T0);
    mockGenerateFact.mockResolvedValue("Ada's own fact");

    // ...but Ada's request must not reuse it as her cache
    const result = await getFact(ada.id, secondsAfter(T0, 1));

    expect(result).toMatchObject({ status: "new", text: "Ada's own fact" });
    expect(mockGenerateFact).toHaveBeenCalledWith(MOVIE, []); // Bob's fact not sent either
  });

  it("does not fall back to another user's fact when OpenAI fails", async () => {
    const ada = await createUser("Ada", MOVIE);
    const bob = await createUser("Bob", MOVIE);
    await createFact(bob.id, MOVIE, "Bob's private fact", T0);
    mockGenerateFact.mockRejectedValue(new Error("timeout"));

    const result = await getFact(ada.id, secondsAfter(T0, 1));

    expect(result).toEqual({ status: "error" });
  });

  it("only ever writes facts to the requesting user", async () => {
    const ada = await createUser("Ada", MOVIE);
    const bob = await createUser("Bob", MOVIE);
    mockGenerateFact.mockResolvedValue("Ada's fact");

    await getFact(ada.id, T0);

    expect(await countFacts(ada.id)).toBe(1);
    expect(await countFacts(bob.id)).toBe(0);
  });

  it("returns an error for a user with no favorite movie", async () => {
    const user = await createUser("Ada", null);

    expect(await getFact(user.id, T0)).toEqual({ status: "error" });
    expect(mockGenerateFact).not.toHaveBeenCalled();
  });
});
