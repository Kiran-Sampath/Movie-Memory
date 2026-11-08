"use client";

// The movie title input, shared by onboarding and the dashboard's edit form.
// When TMDB is configured it shows suggestions while typing; otherwise it is a
// plain text input. Either way it submits a field named "movie".
import { useEffect, useState, type KeyboardEvent } from "react";
import { MOVIE_MAX_LENGTH } from "@/lib/validation";
import type { MovieSearchResponse } from "@/app/api/movies/search/route";

type Suggestion = MovieSearchResponse["results"][number];

const DEBOUNCE_MS = 300;

type MovieInputProps = {
  suggestionsEnabled: boolean;
  initialValue?: string;
  autoFocus?: boolean;
  className?: string; // extra classes for the <input>, e.g. corner rounding
};

export function MovieInput({
  suggestionsEnabled,
  initialValue = "",
  autoFocus = false,
  className = "",
}: MovieInputProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // highlighted suggestion, -1 = none

  // Fetch suggestions 300ms after the user stops typing. Each new keystroke
  // cancels the previous timer and request, so an old, slower response can
  // never overwrite a newer one.
  useEffect(() => {
    if (!suggestionsEnabled || !open) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/movies/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const data: MovieSearchResponse = response.ok ? await response.json() : { results: [] };
        setSuggestions(data.results);
        setActive(-1);
      } catch {
        // Aborted or offline: keep whatever is shown; the input still works.
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, suggestionsEnabled]);

  const showList = suggestionsEnabled && open && suggestions.length > 0;

  function choose(suggestion: Suggestion) {
    setQuery(suggestion.label);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault(); // pick the suggestion instead of submitting
      choose(suggestions[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        id="movie"
        name="movie"
        type="text"
        required
        maxLength={MOVIE_MAX_LENGTH}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="e.g. Spirited Away"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={showList}
        aria-controls="movie-suggestions"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `movie-option-${active}` : undefined}
        className={`w-full border border-line bg-panel px-4 py-3 text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none ${className}`}
      />

      {showList && (
        <ul
          id="movie-suggestions"
          role="listbox"
          className="absolute top-full right-0 left-0 z-10 mt-1 max-h-80 overflow-auto rounded-sm border border-line bg-panel py-1 shadow-lg"
        >
          {!query.trim() && (
            <li role="presentation" className="px-4 pt-1 pb-2 text-xs uppercase tracking-widest text-muted">
              Top rated
            </li>
          )}
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`movie-option-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown (not click) so the input doesn't lose focus and
              // close the list before the choice is registered
              onMouseDown={(event) => {
                event.preventDefault();
                choose(suggestion);
              }}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer justify-between gap-4 px-4 py-2 ${
                index === active ? "bg-line" : ""
              }`}
            >
              <span className="truncate">{suggestion.title}</span>
              {suggestion.year && <span className="text-muted">{suggestion.year}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// TMDB's terms ask apps to credit them. Shown only when suggestions are on.
export function TmdbCredit() {
  return (
    <p className="mt-6 text-xs text-muted/70">
      Suggestions use the TMDB API but this app is not endorsed or certified by TMDB.
    </p>
  );
}
