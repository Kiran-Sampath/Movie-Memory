import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

// Auth.js reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the
// environment automatically.
export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter stores users, Google accounts and sessions in Postgres.
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  // "database" sessions: the cookie holds a random token that points to a row
  // in the Session table. Logging out deletes that row, so the session is
  // really gone (unlike a JWT, which stays valid until it expires).
  session: { strategy: "database" },
  callbacks: {
    // Expose the user's id on the session; every query is scoped by it.
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
