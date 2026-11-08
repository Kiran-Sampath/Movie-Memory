import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { Suspense } from "react";
import { Avatar } from "./avatar";
import { FunFact, FunFactLoading } from "./fun-fact";

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

      <section className="mt-16 border-t border-line pt-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Your favorite film</p>
        <h1 className="mt-2 font-serif text-5xl font-bold leading-tight">
          {user.favoriteMovie}
        </h1>
      </section>

      <section className="mt-12">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Fun fact</p>
        <div className="mt-3">
          {/* The page shows immediately; the fact streams in when OpenAI answers. */}
          <Suspense fallback={<FunFactLoading />}>
            <FunFact userId={userId} movie={user.favoriteMovie} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
