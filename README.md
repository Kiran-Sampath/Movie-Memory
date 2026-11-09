# Movie Memory

Sign in with Google, tell the app your favorite movie, and get a fun fact about it on your dashboard. Facts come from OpenAI and are cached for 60 seconds per user.

Built with Next.js 16 (App Router), TypeScript, Tailwind, Postgres, Prisma 7, Auth.js (Google) and the OpenAI API.

I chose **Variant A (backend: caching and correctness)**. More on that below.


## Running it locally

You need Node 22+ and Docker.

1. Install dependencies. This also generates the Prisma client.

   ```bash
   npm install
   ```

2. Start Postgres. This runs Postgres 16 in Docker on port **5433** (not the default 5432, so it won't clash with a Postgres you may already have installed). On first start it also creates a second database, `moviememory_test`, for the tests.

   ```bash
   docker compose up -d
   ```

3. Create your `.env` from the example and fill it in (see the next section).

   ```bash
   cp .env.example .env
   ```

4. Create the tables.

   ```bash
   npx prisma migrate deploy
   ```

5. Start the app and open http://localhost:3000.

   ```bash
   npm run dev
   ```

To run the tests (Docker needs to be running):

```bash
npm test
```


## Environment variables

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. The value in `.env.example` matches `docker-compose.yml`. |
| `AUTH_SECRET` | yes | Random string Auth.js uses to sign cookies. Generate one with `npx auth secret` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `AUTH_GOOGLE_ID` | yes | Google OAuth client ID. |
| `AUTH_GOOGLE_SECRET` | yes | Google OAuth client secret. |
| `OPENAI_API_KEY` | yes | OpenAI API key. |
| `OPENAI_MODEL` | no | Defaults to `gpt-5.4-mini`. |
| `TMDB_API_TOKEN` | no | Turns on movie suggestions while typing and a poster on the dashboard. Either TMDB's "API Read Access Token" or its "API Key" works. Leave it empty and the app works without them. |
| `TEST_DATABASE_URL` | no | Only if your test database isn't the default `moviememory_test` on port 5433. |

None of these are exposed to the browser (there are no `NEXT_PUBLIC_` variables).

**Getting Google credentials:** in Google Cloud Console, set up the OAuth consent screen (External, add yourself as a test user), then create an OAuth client ID of type "Web application" with:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`


## Database migrations

The schema is in `prisma/schema.prisma` and migrations are committed in `prisma/migrations/`.

- Apply existing migrations (what you need to run the app): `npx prisma migrate deploy`
- After changing the schema, create a new migration: `npx prisma migrate dev --name <what-changed>`

The test setup applies migrations to the test database automatically before the tests run.


## Architecture

### How a request flows

Every page is a server component that checks the session first.

- `/` shows the landing page. If you're signed in it sends you to `/dashboard`.
- Signing in goes through Google and comes back to `/dashboard`.
- `/dashboard` sends you to `/` if you aren't signed in, and to `/onboarding` if you haven't picked a movie yet. That one check is how first-time and returning users are told apart, so the auth callback doesn't need any special logic.
- `/onboarding` sends you to `/dashboard` if you already have a movie.

Saving or changing the movie goes through server actions (`src/app/onboarding/actions.ts`, `src/app/dashboard/actions.ts`). They read the session again themselves, validate the input on the server, and only ever write to the signed-in user's row.

The only API route I wrote is `GET /api/movies/search`, which the movie input calls for suggestions. Everything else is server components and server actions, so there wasn't a need for a separate API layer.

### Data model

```
User      id, name?, email?, image?, favoriteMovie?, ...
Account   Google identity linked to a User (Auth.js)
Session   one row per login; the cookie holds its token (Auth.js)
Fact      id, userId, movie, text, createdAt
          index on (userId, movie, createdAt desc)
```

- `User`, `Account` and `Session` are the standard Auth.js tables. I use database sessions rather than JWTs, so logging out deletes the session row and it's really gone.
- `favoriteMovie` lives on `User`. There's one movie per user, and `null` doubles as "hasn't onboarded yet", so it didn't need its own table or a separate flag.
- `Fact.movie` stores the title the fact was generated for. The cache is per user and movie, so when someone changes their movie the old facts simply stop matching and are kept as history.
- The index matches the one query the fact logic runs: the newest facts for this user and movie.

### Fact generation (the Variant A part)

All of it is in `src/lib/facts.ts`, in one function: `getFact(userId, now)`.

```
read the user's current movie
BEGIN
  pg_advisory_xact_lock(hashtext(userId))      one request per user at a time
  recent = last 5 facts for (userId, movie)
  if newest is less than 60s old            -> return it ("cached")
  ask OpenAI, passing the recent facts so it doesn't repeat them
    got a fact      -> store it with createdAt = now -> "new"
    film unknown    -> newest fact if any, else "unknown" (nothing stored)
    OpenAI failed   -> newest fact if any ("stale"), else "error"
COMMIT (the lock is released automatically)

if the transaction itself fails (timeout, DB error):
  read the newest fact outside the lock -> "stale", or "error"
```

**60-second window.** A fact counts as fresh if it's less than 60 seconds old, measured from when it was created. At exactly 60 seconds a new one is generated. `now` is passed in and new facts are saved with that same value, so the comparison never mixes the app's clock with the database's, and tests can control time.

**Burst protection.** I used a Postgres advisory lock keyed on the user id. When two requests arrive together (fast refreshes, several tabs), the second one waits inside Postgres until the first commits. It then checks for a fresh fact *after* getting the lock, finds the one that was just saved, and returns it. So there's one OpenAI call and one row. The check has to come after the lock; if both requests checked first, both would see "nothing fresh" and both would call OpenAI.

Why this over the other options in the brief:

- A unique constraint per 60-second window stops duplicate rows, but both requests would already have paid for an OpenAI call before the insert failed.
- A "generation in progress" flag gets stuck if the server dies mid-request, so it needs an expiry and cleanup.
- An in-memory lock only works with a single server process.
- The advisory lock is released automatically when the transaction ends, even on a crash, it's per user so users don't block each other, and it works across any number of server instances.

**Failure handling.** The OpenAI client has a 10-second timeout and no retries, so failures come back quickly. If there's a previous fact it's shown with a note saying it's the last one; if not, the user gets a friendly message. Failed or "unknown film" responses are never stored, so the fallback is always a real fact. The transaction is allowed 25 seconds, enough for a waiting request to make its own OpenAI call if the first one failed.

On the dashboard the fact loads inside `<Suspense>`, so the page appears straight away and the fact streams in. A small line under it says whether it's fresh, cached (with a countdown to the next one) or a fallback.

### OpenAI usage

`src/lib/openai.ts` is marked `server-only`, so the build fails if anything in the browser bundle imports it.

- I compared a few small models on the same prompt and picked `gpt-5.4-mini` with reasoning turned off. It gave the most accurate facts, takes about a second, and costs a fraction of a cent per fact. `gpt-5.4-nano` invented a fact in testing, and `gpt-4.1-mini` gave a shakier one.
- The prompt tells the model to treat the title as data and ignore instructions in it, to only state well-documented facts, to keep it family-friendly, and to reply `UNKNOWN` if it doesn't recognise the film (for example a 2026 release, which is newer than what the model knows). The code checks for `UNKNOWN` and shows "it may be too new" instead of storing it.
- Earlier versions of the prompt returned the same fact every minute, and when I first asked for "a different one" it made one up. The current wording asks for a different fact but says repeating a true one is better than guessing.

### Optional TMDB features

If `TMDB_API_TOKEN` is set, the movie input shows suggestions (top rated when empty, search results as you type) and the dashboard shows the poster. The browser only talks to our own `/api/movies/search` route, which requires a signed-in user, so the TMDB key stays on the server and the route can't be used as an open proxy. Every TMDB call has a 3-second timeout and returns an empty result on failure, so the app behaves exactly as it does without TMDB.

Picking a suggestion saves the title with its year, like "Dune (2021)". That helps OpenAI pick the right film and lets the poster lookup tell remakes apart.

### Where things are

```
src/auth.ts                         Auth.js config (Google, Prisma adapter, database sessions)
src/lib/db.ts                       Prisma client
src/lib/facts.ts                    cache, lock and fallback logic
src/lib/openai.ts                   OpenAI call and prompt
src/lib/tmdb.ts                     optional TMDB search and posters
src/lib/validation.ts               movie title validation
src/app/page.tsx                    landing page
src/app/onboarding/                 first-time movie form + server action
src/app/dashboard/                  dashboard, fun fact, poster, change-movie form + action
src/app/api/movies/search/route.ts  suggestions endpoint
src/components/movie-input.tsx      shared movie input with suggestions
tests/                              Vitest tests
```


## Security

- Movie titles are validated on the server (trimmed, repeated spaces collapsed, 1 to 100 characters) in both server actions. The browser's `maxLength` is only a convenience.
- Every read and write uses the user id from the session. No route or action accepts a user id from the client, so there's nothing to tamper with.
- Secrets are only read in `server-only` modules, and the browser only learns whether TMDB is turned on, never the key.
- A missing Google photo falls back to initials, a missing name to "Movie fan", and a missing email line is simply not shown.


## Tests

`npm test` runs Vitest against the real `moviememory_test` database with OpenAI mocked. I used a real database because the parts that matter most here (transactions, the advisory lock, the `userId` filters) only behave for real in Postgres. The tests refuse to run unless the database name ends in `_test`, since they empty the tables.

They cover:

- **Cache:** first fact is generated, a 59.9-second-old fact is reused, a 60-second-old one is replaced, recent facts are sent to OpenAI, a changed movie doesn't reuse the old movie's fact.
- **Burst protection:** two simultaneous requests make one OpenAI call and one row; two different users don't wait for each other. I checked this test fails with the lock removed.
- **Failures:** stale fallback, friendly error with no facts, unknown films not stored.
- **Authorization:** another user's fact for the same movie is never returned, never used as a fallback and never sent to OpenAI; facts are only written for the requesting user.
- **Validation** of movie titles.

The login redirects themselves (logged out on `/dashboard` goes to `/`, the search route returns 401) I checked by hand rather than with automated tests, because faking Auth.js sessions in tests is fiddly.


## Why Variant A

The backend side is where this app can actually go wrong in ways a user wouldn't notice straight away: two tabs quietly making duplicate OpenAI calls, a cache that's off by a few seconds, or a failed request showing an error when a perfectly good fact is sitting in the database. I wanted to get those right and be able to prove it with tests, rather than spend the time on client-side state.


## Tradeoffs

- **The lock holds a database connection while OpenAI responds** (about a second, up to 10 on timeout). That's fine at this scale. With a lot of traffic I'd switch to a short-lived "lease" row so the connection isn't held.
- **"Unknown film" replies aren't cached.** Refreshing on a very new film asks OpenAI again each time (still one request at a time per user). Caching those would need another column or table.
- **The cache key is the movie title string.** "Dune" and "Dune (2021)" count as different movies. Suggestions keep titles consistent, but a typed title can differ.
- **Database sessions instead of JWTs.** One extra database read per request, in exchange for logout really ending the session.
- **No API layer.** Server components and server actions cover everything except the suggestions endpoint. It's less code, but there's no reusable API for another client.
- **Next.js Cache Components is turned off.** Every page reads the session cookie, so every page is per-request anyway, and leaving it on adds Suspense rules without any benefit here.
- **The poster is looked up on every dashboard load** instead of being stored. No schema change, but it's an extra TMDB request and a typed title without a year can match the wrong film.
- **A prompt can't guarantee facts are true.** The model and prompt were picked to reduce made-up facts, but nothing checks them against a source.
- **Google is the only sign-in method,** since that's what the brief asked for. Email sign-in would need an email service and verification tokens.


## What I'd do with 2 more hours

- Replace the held connection with a "generation in progress" lease row that expires, so waiting requests don't tie up connections.
- Cache "unknown film" results for 60 seconds too.
- Save TMDB's movie id when a suggestion is picked, so the poster and the cache key are exact.
- Ground facts in real data (TMDB details or Wikipedia) instead of relying only on the model.
- Add end-to-end tests (Playwright) for the sign-in and onboarding redirects.
- Rate limit fact generation and the search route per user.
- Add a "new fact" button that skips the cache, with its own rate limit.


## AI usage

I used an AI coding assistant throughout this project:

- To read the brief with me and work out a minimal plan and schema before writing any code.
- To scaffold the project and check what changed in Next.js 16, Prisma 7, Auth.js v5 and the OpenAI SDK compared with older versions.
- To draft code, which I then ran, tested in the browser, and asked to change when something was off (for example the TMDB 401, and facts being saved when the model didn't know the film).
- To compare OpenAI models side by side and tune the prompt after it repeated facts and, at one point, made one up.
- To write the tests, including checking that the burst test fails when the lock is removed.

The decisions were mine:

- Variant A, a minimal scope, and local Docker Postgres.
- Caching in the database: a fact is reused for 60 seconds per user and movie.
- A Postgres advisory lock for burst protection (instead of a unique constraint, an in-progress flag or an in-memory lock), with the cache checked after taking the lock.
- On OpenAI failure, show the last stored fact, and never store failed or "unknown film" replies.
- Database sessions, server actions instead of a separate API, and user ids only ever taken from the session.
- Testing against real Postgres with only OpenAI mocked.
- `gpt-5.4-mini` to fit a small budget, plus the extras: optional TMDB suggestions and posters, editing your movie, no repeated facts, and the visual style.
