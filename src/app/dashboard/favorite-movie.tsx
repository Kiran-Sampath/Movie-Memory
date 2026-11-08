"use client";

// Shows the favorite movie with a "Change" button that swaps in an edit form.
import { useActionState, useState, type ReactNode } from "react";
import { updateFavoriteMovie, type UpdateMovieState } from "./actions";
import { MovieInput, TmdbCredit } from "@/components/movie-input";

type Props = { movie: string; suggestionsEnabled: boolean };

// `poster` is rendered on the server (it calls TMDB) and passed in as a slot;
// this client component just places it.
export function FavoriteMovie({
  movie,
  suggestionsEnabled,
  poster,
}: Props & { poster?: ReactNode }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="mt-16 border-t border-line pt-10">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Your favorite film</p>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Change
          </button>
        )}
      </div>

      <div className="mt-3 flex items-start gap-6">
        {poster}
        <div className="min-w-0 flex-1">
          {editing ? (
            <EditMovieForm
              movie={movie}
              suggestionsEnabled={suggestionsEnabled}
              onDone={() => setEditing(false)}
            />
          ) : (
            <h1 className="font-serif text-4xl font-bold leading-tight break-words sm:text-5xl">
              {movie}
            </h1>
          )}
        </div>
      </div>
    </section>
  );
}

// Mounted only while editing, so its error state starts fresh each time.
function EditMovieForm({
  movie,
  suggestionsEnabled,
  onDone,
}: Props & { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    async (previous: UpdateMovieState, formData: FormData) => {
      const next = await updateFavoriteMovie(previous, formData);
      if (!next.error) onDone(); // saved: back to the normal view
      return next;
    },
    {},
  );

  return (
    <form action={formAction}>
      <label htmlFor="movie" className="sr-only">
        Favorite movie
      </label>
      <MovieInput
        suggestionsEnabled={suggestionsEnabled}
        initialValue={movie}
        autoFocus
        className="rounded-sm"
      />

      {state.error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-accent px-5 py-2 font-semibold text-screen hover:bg-accent-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="rounded-sm border border-line px-5 py-2 text-muted hover:border-muted hover:text-fg"
        >
          Cancel
        </button>
      </div>

      {suggestionsEnabled && <TmdbCredit />}
    </form>
  );
}
