import { execSync } from "node:child_process";

// Runs once before all tests: brings the test database's tables up to date
// with the same migrations the app uses.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5433/moviememory_test?schema=public";
  assertTestDatabase(url);

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}

// Tests delete every row, so refuse to run against anything that doesn't
// look like a test database.
export function assertTestDatabase(url: string) {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to run tests against "${name}": the database name must end in _test`);
  }
}
