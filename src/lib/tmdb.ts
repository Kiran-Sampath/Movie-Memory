// Optional TMDB (themoviedb.org) features: movie suggestions while typing and
// the poster on the dashboard. The token is only ever used here, on the
// server; the browser talks to our own routes and pages instead.
import "server-only";

export type MovieSuggestion = {
  id: number;
  title: string;
  year: string | null;
  label: string; // what goes in the input, e.g. "The Matrix (1999)"
};

type TmdbMovie = {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
};

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342"; // 342px wide posters
const MAX_RESULTS = 8;
const TIMEOUT_MS = 3_000;

// TMDB features are on only when a token is configured.
export function isTmdbEnabled(): boolean {
  return Boolean(process.env.TMDB_API_TOKEN);
}

export async function searchMovies(query: string): Promise<MovieSuggestion[]> {
  const movies = await tmdbGet("/search/movie", { query, include_adult: "false" });
  return toSuggestions(movies);
}

export async function topRatedMovies(): Promise<MovieSuggestion[]> {
  return toSuggestions(await tmdbGet("/movie/top_rated", {}));
}

// Finds a poster for a saved favorite movie, or null if there isn't one.
// Titles picked from suggestions end in the year, e.g. "Dune (1984)"; we use
// it to pick the right film when there are remakes.
export async function findPosterUrl(movie: string): Promise<string | null> {
  const match = movie.match(/^(.*\S)\s+\((\d{4})\)$/);
  const params: Record<string, string> = match
    ? { query: match[1], primary_release_year: match[2] }
    : { query: movie };

  const movies = await tmdbGet("/search/movie", { ...params, include_adult: "false" });
  const posterPath = movies.find((m) => m.poster_path)?.poster_path;
  return posterPath ? IMAGE_BASE_URL + posterPath : null;
}

// Never throws: if TMDB is missing, slow or failing we return an empty list,
// and the app carries on without suggestions or posters.
async function tmdbGet(path: string, params: Record<string, string>): Promise<TmdbMovie[]> {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) return [];

  const url = new URL(BASE_URL + path);
  url.search = new URLSearchParams({ language: "en-US", page: "1", ...params }).toString();

  // TMDB gives two kinds of credentials and accepts both:
  //  - the long "API Read Access Token" (a JWT, starts with "eyJ") -> Bearer header
  //  - the short 32-character "API Key" -> api_key query parameter
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    url.searchParams.set("api_key", token);
  }

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`TMDB ${path} failed with status ${response.status}`);
      return [];
    }
    const body = (await response.json()) as { results?: TmdbMovie[] };
    return body.results ?? [];
  } catch (error) {
    console.error(`TMDB ${path} request failed`, error);
    return [];
  }
}

function toSuggestions(movies: TmdbMovie[]): MovieSuggestion[] {
  return movies
    .filter((movie) => movie.title)
    .slice(0, MAX_RESULTS)
    .map((movie) => {
      const title = movie.title!;
      const year = movie.release_date?.slice(0, 4) || null;
      return { id: movie.id, title, year, label: year ? `${title} (${year})` : title };
    });
}
