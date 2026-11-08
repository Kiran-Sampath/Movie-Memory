import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { isTmdbEnabled } from "@/lib/tmdb";
import { Avatar } from "./avatar";
import { FavoriteMovie } from "./favorite-movie";
import { FunFact, FunFactLoading } from "./fun-fact";
import { Poster, PosterPlaceholder } from "./poster";

export default async function DashboardPage() {
  // Logged out -> back to the landing page (which has the sign-in button).
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  // Read from the database rather than the session so the movie is current.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, image: true, favoriteMovie: true },
  });
  // First-time users (no movie yet) go to onboarding.
  if (!user?.favoriteMovie) redirect("/onboarding");

  const tmdbEnabled = isTmdbEnabled();

  async function logOut() {
    "use server";
    // Deletes the Session row and clears the cookie.
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="py-10">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} email={user.email} image={user.image} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{user.name ?? "Movie fan"}</p>
          {user.email && <p className="truncate text-sm text-muted">{user.email}</p>}
        </div>
        <form action={logOut}>
          <button
            type="submit"
            className="rounded-sm border border-line px-3 py-1.5 text-sm text-muted hover:border-muted hover:text-fg"
          >
            Log out
          </button>
        </form>
      </div>

      <FavoriteMovie
        movie={user.favoriteMovie}
        suggestionsEnabled={tmdbEnabled}
        poster={
          // Only with TMDB set up. Streams in like the fact, so a slow TMDB
          // never holds up the page.
          tmdbEnabled && (
            <Suspense key={user.favoriteMovie} fallback={<PosterPlaceholder />}>
              <Poster movie={user.favoriteMovie} />
            </Suspense>
          )
        }
      />

      <section className="mt-12">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Fun fact</p>
        <div className="mt-3">
          {/* The page shows immediately; the fact streams in when OpenAI answers.
              key: a new movie remounts this, so the loading state shows again
              instead of the previous movie's fact. */}
          <Suspense key={user.favoriteMovie} fallback={<FunFactLoading />}>
            <FunFact userId={userId} movie={user.favoriteMovie} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
