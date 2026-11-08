"use client";

// Client component so it can show the server's validation error (via
// useActionState) without a full page reload.
import { useActionState } from "react";
import { saveFavoriteMovie, type OnboardingState } from "./actions";
import { MovieInput, TmdbCredit } from "@/components/movie-input";

const initialState: OnboardingState = {};

export function MovieForm({ suggestionsEnabled }: { suggestionsEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(saveFavoriteMovie, initialState);

  return (
    <form action={formAction} className="mt-8">
      <label htmlFor="movie" className="text-sm uppercase tracking-widest text-muted">
        Favorite movie
      </label>
      <div className="mt-2 flex">
        <MovieInput suggestionsEnabled={suggestionsEnabled} className="rounded-l-sm" />
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

      {suggestionsEnabled && <TmdbCredit />}
    </form>
  );
}
