import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { MovieForm } from "./movie-form";

export default async function OnboardingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  // Onboarding is first-time only: anyone who already has a movie goes on.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { favoriteMovie: true },
  });
  if (user?.favoriteMovie) redirect("/dashboard");

  return (
    <section className="py-20">
      <h1 className="font-serif text-4xl font-bold">What&apos;s your favorite movie?</h1>
      <p className="mt-3 text-muted">
        Just one. We&apos;ll remember it for you.
      </p>
      <MovieForm />
    </section>
  );
}
