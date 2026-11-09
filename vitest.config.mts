import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests run against a separate database (created by docker/init.sql) so they
// can wipe tables freely without touching your dev data.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/moviememory_test?schema=public";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" throws when imported outside Next.js's server build.
      // In tests we are on the server anyway, so swap it for an empty module.
      "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: ["tests/global-setup.ts"],
    // Every test file shares one database, so run files one at a time.
    fileParallelism: false,
  },
});

