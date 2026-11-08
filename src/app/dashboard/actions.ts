"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { validateMovie } from "@/lib/validation";

export type UpdateMovieState = { error?: string };

// Changes the signed-in user's favorite movie from the dashboard.
// Same rules as onboarding: re-check the session, validate on the server, and
// only ever write to the session user's own row.
export async function updateFavoriteMovie(
  _previous: UpdateMovieState,
  formData: FormData,
): Promise<UpdateMovieState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const result = validateMovie(formData.get("movie"));
  if (!result.ok) return { error: result.error };

  await prisma.user.update({
    where: { id: userId },
    data: { favoriteMovie: result.value },
  });

  // Re-render the dashboard with the new movie. Facts are stored per movie,
  // so the old movie's facts no longer match and a fresh fact is fetched.
  revalidatePath("/dashboard");
  return {};
}
