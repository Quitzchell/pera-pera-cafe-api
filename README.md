# Pera Pera Cafe

The backend of a Japanese verb conjugation trainer. A learner signs in, starts a drill round and gets prompts such as "泳ぐ → te-form". They type the answer in kana or kanji and get instant feedback: correct or not, the expected form, and the rule in one line (`ぐ → いで (泳ぐ → 泳いで)`). Rule groups the learner gets wrong come back sooner, through spaced repetition.

It is a private app, not a SaaS: there is no sign-up. The admin creates every account and shares an invite link.

This repo is the REST API. The frontend lives in a separate repo; its contract is [`docs/frontend-brief.md`](docs/frontend-brief.md).

## Stack

- **NestJS 12** on **Node 26**, CommonJS, TypeScript 6
- **Prisma 7** with **PostgreSQL**
- class-validator DTOs behind a global `ValidationPipe` (unknown fields are rejected)
- Jest unit tests and Supertest e2e tests against a real Postgres
- Docker for development (hot reload) and production (multi-stage, non-root)

## How it works

### Conjugation engine (`src/conjugation`)

A pure TypeScript module, without Nest or Prisma, that computes 16 forms from rules. Answers are never stored per verb.
- Godan, ichidan, する and 来る are covered.
- Exceptions: 行く (行って), and ある (its negative is ない).
- Compounds (勉強する, 持って来る) conjugate their base verb.
- Each verb and form belongs to a **rule group** such as `GODAN_GU` or `EXCEPTION_IKU`.

A hand-written table of 37 verbs and 3 compounds across all forms tests it.

### Drill and spaced repetition (`src/drill`)

- **Answers** are checked on the server only.
  - Kana and kanji are both accepted; the short causative-passive (書かされる) counts as correct.
  - Ra-nuki (見れる) is marked wrong, with a note.
- **Every answer is appended to the `Attempt` log.** `RuleProgress` (a Leitner box from 0 to 5 per form and rule group, due after 1, 3, 7, 16, 35 or 60 days) is a projection of that log, and can be rebuilt from it at any time.
- **Rounds** take, in order:
  - due rule groups (lowest box first, then most overdue);
  - then the weakest by accuracy;
  - then a few new combinations.
  - Each verb appears once at most, and a round has at most 2 compounds.
- **Modes:**
  - `STANDARD`;
  - `CONTRAST`: the same verb in two easily confused forms, back to back;
  - `EXAM`: multiple choice, with wrong options built from realistic mistakes.

### Accounts and security (`src/auth`, `src/users`)

- **Default access:** every route needs a signed-in user unless it is marked `@Public()`. Admin routes are marked `@AdminOnly()`.
- **Ownership and state checks** live in the services, next to the operation they protect (for example `assertOwnsRound`).
- **Passwords** are hashed with argon2id from `node:crypto`.
- **Sessions:** the cookie is `HttpOnly; Secure; SameSite=Lax`, and the database stores only a hash of its token.
  - Logout, disabling the user and a password reset all end the session.
- **CSRF:** a session-bound token, sent back by the client in the `X-CSRF-Token` header on every state-changing request.
- **Brute force:**
  - From the 5th wrong password on, the next attempt is only checked after a wait: 1 minute, then 2, and so on, up to 15. Attempts during the wait don't count, and the right password after the wait always signs in, so nobody can lock an account for good.
  - Login and the token routes are rate-limited to 10 requests a minute per IP.
  - At most 4 password hashes run at once; extra logins queue.
- **Links:** invite and reset links are single-use, and only their hash is stored.
- **Errors** always come back as `{ statusCode, error, message }`.

### Modules

| Module | Routes |
|---|---|
| `auth` | `/auth/login`, `logout`, `me`, `csrf`, `accept-invite`, `reset-password` |
| `users` | `/admin/users` (create/invite, enable/disable, delete, reset link, progress) |
| `verbs` | `/admin/verbs` (list/search, create, update; every save is checked by the engine) |
| `settings` | `/me/settings` |
| `drill` | `/drill/rounds`, answers, finish |
| `progress` | `/progress`, `/progress/export?format=csv\|json` |
| `health` | `/health` (liveness, no database) |

All routes are under `/api`. Full request and response shapes are in the [frontend brief](docs/frontend-brief.md).

## Running locally

Requirements: Docker, and a PostgreSQL container reachable on the external Docker network `postgres-17_default` under the hostname `postgres`.

```bash
echo 'POSTGRES_PASSWORD=<your local postgres password>' > .env
make up                      # dev server with hot reload on http://localhost:3000
docker compose run --rm --no-deps app npx prisma migrate deploy
docker compose run --rm --no-deps app npx prisma db seed     # 280 common N5, N4 and N3 verbs
make logs
```

- `APP_PORT=3001 make up` serves on another host port.
- After changing dependencies, run `make rebuild`. The container keeps its own Linux `node_modules`.
- Locally the cookie is sent without `Secure` (`COOKIE_SECURE=false` in `docker-compose.yml`), because there is no HTTPS.

### Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | – | Postgres connection string (built from `POSTGRES_PASSWORD` in dev, from `PERA_DB_*` in production) |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin(s), comma-separated. The first one is used in invite and reset links |
| `COOKIE_DOMAIN` | host only | Leave empty. Set a parent domain (`example.com`) only if the API must receive the cookie on more than one subdomain |
| `COOKIE_SECURE` | `true` | `false` only for local HTTP |
| `COOKIE_SAMESITE` | `lax` | `lax`, `strict` or `none` |
| `TRUST_PROXY` | `0` (prod compose: `1`) | Number of reverse proxies in front of the app, so rate limiting sees the client IP |

### Tests

```bash
npm test              # unit tests (engine, answer checking, Leitner, rounds, exam choices, seed data)
make test-e2e         # e2e tests in Docker against a throwaway Postgres; never touches your database
npm run lint
```

## Accounts and content

### Create the first admin

Credentials come from the environment and are never stored in the repo:

```bash
read -rs ADMIN_PASSWORD && export ADMIN_PASSWORD   # at least 12 characters; not echoed, not in shell history
docker compose run --rm --no-deps -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD app npm run create-admin
unset ADMIN_PASSWORD
```

You sign in with the username. Usernames are 3–30 characters (a–z, 0–9, `_`, `-`). The app stores no email addresses: there is no mail server, and links are shared by hand.

### Invite a learner

1. Sign in as admin in the frontend, go to **Users** and create a user (a username). Or use the API: `POST /api/admin/users`.
2. Copy the invite link (valid for 7 days) and send it yourself; the app sends no e-mail.
3. The learner opens the link and chooses a password; their account becomes active.
4. If the learner forgets their password, use **Create reset link** (valid for 24 hours). For a learner who never accepted their invite, the same button creates a fresh invite.

### Add a verb

Go to **Verbs** in the admin screens, or use `POST /api/admin/verbs`:

```json
{ "dictionaryForm": "泳ぐ", "reading": "およぐ", "meaning": "to swim", "verbClass": "GODAN", "jlptLevel": "N5" }
```

- The engine checks every save. A broken verb gets a `400` (an ichidan verb that does not end in -iru/-eru, or a reading that is not hiragana).
- A probably wrong class is saved with a warning ("帰る is usually godan, not ichidan").
- `excludedForms` lists forms that should never be drilled for this verb, for example `["POTENTIAL", "POTENTIAL_CONDITIONAL"]` for 分かる.
- For a compound, send `baseVerbId` (the id of する, 来る or 行く) and leave out `verbClass`.
- Verbs are never deleted; set `isActive: false`.

The seed data is in [`prisma/seed-data/verbs.json`](prisma/seed-data/verbs.json). Re-running the seed updates the seeded verbs and overwrites admin edits to them, so run it once per database.

### Maintenance commands

```bash
npm run rebuild-progress -- some-username   # rebuild RuleProgress from the Attempt log (or: -- --all)
```

In the production image, run the compiled scripts instead: `node dist/src/cli/create-admin.js`, `node dist/src/cli/seed-verbs.js`, `node dist/src/cli/rebuild-progress.js`.

## Production

### Same site for frontend and API

The session cookie is `SameSite=Lax`, so the frontend and the API must be on the **same site**:

- **Recommended:** the frontend's host proxies `/api` to this app. Both are then the same origin, CORS is not needed, and the cookie is host-only.
- **Or:** two subdomains of one domain, e.g. `app.example.com` and `api.example.com`. Set `FRONTEND_ORIGIN=https://app.example.com`. `COOKIE_DOMAIN` can stay empty, because the browser sends the API's cookie on requests to the API.

A frontend on a different domain (e.g. `*.vercel.app` with the API elsewhere) will not work, by design. Always serve over HTTPS: the cookie is `Secure`.

### Deploy

Pushing to `master` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It connects to the VPS over SSH, pulls `master`, builds the image, runs `prisma migrate deploy`, and restarts the container with `docker compose -f docker-compose.prod.yml`. A concurrency group stops two deploys from overlapping.

On the server, `.env` needs the variables from [`.env.prod.example`](.env.prod.example). The app joins the external Docker networks `web` (reverse proxy) and `postgres-net` (database).

### First deploy of the rebuild

The production database still holds the old Pera Pera Cafe card-game tables, and their migration history no longer exists in this repo. Before the first deploy of this version:

1. Back up the database (`pg_dump`).
2. Empty the `public` schema, so the old tables and the old `_prisma_migrations` rows are gone. Either `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` as the database owner, or run `npx prisma migrate reset --force` once in a one-off app container.
3. Deploy (the workflow applies the migrations).
4. Seed the verbs once: `docker compose -f docker-compose.prod.yml run --rm app node dist/src/cli/seed-verbs.js`.
5. Create the admin: `docker compose -f docker-compose.prod.yml run --rm -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD app node dist/src/cli/create-admin.js` (with `ADMIN_PASSWORD` exported as above).
