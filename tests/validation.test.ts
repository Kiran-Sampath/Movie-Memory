import { describe, expect, it } from "vitest";
import { MOVIE_MAX_LENGTH, validateMovie } from "@/lib/validation";

describe("validateMovie", () => {
  it("trims and collapses whitespace", () => {
    expect(validateMovie("  The   Matrix  ")).toEqual({ ok: true, value: "The Matrix" });
  });

  it("accepts one-character titles", () => {
    expect(validateMovie("M")).toEqual({ ok: true, value: "M" });
  });

  it("rejects empty and whitespace-only input", () => {
    expect(validateMovie("").ok).toBe(false);
    expect(validateMovie("    ").ok).toBe(false);
  });

  it("rejects titles over the maximum length", () => {
    expect(validateMovie("a".repeat(MOVIE_MAX_LENGTH)).ok).toBe(true);
    expect(validateMovie("a".repeat(MOVIE_MAX_LENGTH + 1)).ok).toBe(false);
  });

  it("rejects anything that isn't text (e.g. a missing form field)", () => {
    expect(validateMovie(null).ok).toBe(false);
    expect(validateMovie(42).ok).toBe(false);
  });
});
