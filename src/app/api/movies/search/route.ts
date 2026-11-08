import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { MOVIE_MAX_LENGTH } from "@/lib/validation";
import { searchMovies, topRatedMovies, type MovieSuggestion } from "@/lib/tmdb";

export type MovieSearchResponse = { results: MovieSuggestion[] };

// GET /api/movies/search?q=matr
//   empty q -> TMDB's top rated films
//   otherwise -> TMDB search results
// Signed-in users only, so the route can't be used as a free proxy to TMDB
// on our token.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .slice(0, MOVIE_MAX_LENGTH);

  const results = query ? await searchMovies(query) : await topRatedMovies();
  return NextResponse.json<MovieSearchResponse>({ results });
}
