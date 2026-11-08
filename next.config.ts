import type { NextConfig } from "next";

// Cache Components is off on purpose: every page here reads the session
// cookie, so every page is per-request anyway. Without it, a page that reads
// cookies is simply rendered on each request, with no extra Suspense rules.
const nextConfig: NextConfig = {
  // next/image only loads remote images from hosts listed here:
  // Google profile photos, and TMDB movie posters.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
