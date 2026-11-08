import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function LandingPage() {
  // Already signed in? Skip the landing page.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  async function signInWithGoogle() {
    "use server";
    // Sends the browser to Google; after consent Auth.js brings it back to
    // /dashboard, which decides between onboarding and the dashboard itself.
    await signIn("google", { redirectTo: "/dashboard" });
  }

  return (
    <section className="py-24">
      <h1 className="font-serif text-5xl font-bold leading-tight">
        Your favorite film, remembered.
      </h1>
      <p className="mt-5 max-w-md text-lg text-muted">
        Tell us the one movie you could watch forever. Every time you come
        back, we&apos;ll have a fun fact about it waiting for you.
      </p>
      <form action={signInWithGoogle} className="mt-10">
        <button
          type="submit"
          className="rounded-sm bg-accent px-5 py-3 font-semibold text-screen hover:bg-accent-dark"
        >
          Sign in with Google
        </button>
      </form>
    </section>
  );
}
