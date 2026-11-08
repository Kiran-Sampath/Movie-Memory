"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { validateMovie } from "@/lib/validation";

export type OnboardingState = { error?: string };

// Called when the onboarding form is submitted. Server actions are public
// endpoints, so this re-checks the session itself instead of trusting the page.
export async function saveFavoriteMovie(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const result = validateMovie(formData.get("movie"));
  if (!result.ok) return { error: result.error };

  // The user id comes from the session, never from the form, so a user can
  // only ever write to their own row.
  // `favoriteMovie: null` makes this first-time only: if a movie is already
  // saved (e.g. the form was submitted twice), nothing is overwritten.
  await prisma.user.updateMany({
    where: { id: userId, favoriteMovie: null },
    data: { favoriteMovie: result.value },
  });

  redirect("/dashboard");
}
