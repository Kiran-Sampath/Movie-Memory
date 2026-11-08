// Server-side validation for the favorite movie. The browser also limits the
// input, but that is only a convenience: anyone can bypass it, so this is the
// check that actually counts.

// 1 because real titles can be one character ("M", "9").
// 100 is generous for a title and keeps the OpenAI prompt small.
export const MOVIE_MIN_LENGTH = 1;
export const MOVIE_MAX_LENGTH = 100;

export type MovieValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validateMovie(input: unknown): MovieValidation {
  if (typeof input !== "string") {
    return { ok: false, error: "Please enter a movie title." };
  }

  // Trim the ends and collapse runs of spaces, so "  The   Matrix " and
  // "The Matrix" are stored the same way.
  const value = input.trim().replace(/\s+/g, " ");

  if (value.length < MOVIE_MIN_LENGTH) {
    return { ok: false, error: "Please enter a movie title." };
  }
  if (value.length > MOVIE_MAX_LENGTH) {
    return {
      ok: false,
      error: `That's a long title. Please keep it under ${MOVIE_MAX_LENGTH} characters.`,
    };
  }

  return { ok: true, value };
}
