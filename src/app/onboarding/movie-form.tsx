"use client";

// The only client component in the app: it needs useActionState to show the
// server's validation error without a full page reload.
import { useActionState } from "react";
import { saveFavoriteMovie, type OnboardingState } from "./actions";
import { MOVIE_MAX_LENGTH } from "@/lib/validation";

const initialState: OnboardingState = {};

export function MovieForm() {
  const [state, formAction, pending] = useActionState(
    saveFavoriteMovie,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8">
      <label htmlFor="movie" className="text-sm uppercase tracking-widest text-muted">
        Favorite movie
      </label>
      <div className="mt-2 flex">
        <input
          id="movie"
          name="movie"
          type="text"
          required
          maxLength={MOVIE_MAX_LENGTH}
          autoComplete="off"
          placeholder="e.g. Spirited Away"
          className="min-w-0 flex-1 rounded-l-sm border border-line bg-panel px-4 py-3 text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-r-sm bg-accent px-5 font-semibold text-screen hover:bg-accent-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
