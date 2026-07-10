# Pera Pera Cafe

A realtime web app for practicing Japanese (and other languages) with friends through interactive, turn-based language games.

Learning a language alone stalls; learning with a partner is fun but hard to structure. Pera Pera Cafe gives a small group a shared room where one person is the "dealer", drawing prompt cards matched to another player's proficiency level and target language. Turns rotate, cards never repeat, and every player sees the same state update instantly. This repository is the backend: the API and realtime engine that drives those sessions.

## What it does

- **Host a session** — pick a target language and your native language; the app pairs them and mints a short join code.
- **Join by code** — other players join the room with their own native language and proficiency levels.
- **Play in realtime** — the host starts the game, the current dealer draws a card for a chosen player in that player's practice language, can skip an unsuitable card, then passes the turn. Every event is broadcast live to the room.

## Tech stack and why

- **NestJS 11** — modular DI keeps the HTTP surface (session setup, joining) cleanly separated from the realtime gameplay engine.
- **Socket.IO gateway** (`@nestjs/websockets`) — gameplay is inherently push-based (a card drawn by one player must appear for everyone), so WebSockets are the transport, not polling.
- **Prisma 7 + PostgreSQL** — relational data (sessions, participants, cards, translations) with a typed client. Gameplay is **event-sourced**: an append-only `SessionEvent` log is the single source of truth for who the current dealer is and which card is in play, so any client that (re)connects can reconstruct exact game state.
- **class-validator + global `ValidationPipe`** — DTOs are whitelisted and non-whitelisted fields are rejected at the edge.
- **Docker** for both dev (hot-reload) and prod (multi-stage, non-root, pruned) so the runtime matches locally and on the server.

## Architecture

Three modules under `src/`:

- **`prisma`** — a thin `PrismaService` wrapping the generated client, shared across the app.
- **`sessions`** — the core. A REST `SessionsController` handles session creation/lookup; the `SessionsGateway` owns the WebSocket lifecycle; `SessionsService` manages session state transitions (start/end, host-only); `GameplayService` implements the card/turn rules.
- **`participants`** — REST endpoints for joining a session and fetching a participant.

**Authorization** is enforced at two layers rather than with a single blanket guard. The gateway authenticates every socket at handshake time (a valid `participantId` + `sessionId` pair, or the connection is dropped) and stamps identity onto `socket.data`. Business rules are then enforced as service-level assertions: `assertActive` (session must be running), `assertDealer` (only the current dealer may draw/skip/pass), and host-only checks for starting and ending a session. Each rule lives with the operation it protects and stays testable without a socket.

**Gateway events:** `session:start` / `session:end`, `card:draw`, `card:skip`, `turn:pass` inbound; `presence:list`, `participant:joined` / `participant:left`, `session:status`, `game:state`, `card:drawn`, `turn:passed` outbound. On connect, a client receives current presence plus live game state, so a mid-game refresh recovers seamlessly.

## Testing

E2E tests (`test/`, Supertest) exercise the real HTTP stack — routing, the global `api` prefix, and the `ValidationPipe` — by booting the actual `AppModule` and overriding only `PrismaService` with a mock. This verifies the true request surface (validation errors, business-rule 400s) without needing a database in CI.

```bash
npm run test:e2e
```

## CI/CD

A GitHub Actions workflow (`.github/workflows/deploy.yml`) deploys on push to `master`. It SSHes into the VPS, pulls the latest code, and rebuilds/restarts the production stack via `docker compose -f docker-compose.prod.yml`. A `concurrency` group serializes deploys so overlapping pushes cannot race.

## Running locally

Requires Docker and a PostgreSQL instance reachable on the shared `postgres-17_default` network (see `docker-compose.yml`).

```bash
cp .env.prod.example .env      # then set DATABASE_URL / CORS_ORIGIN
make up                        # build + start with hot reload on :3000
npx prisma migrate dev         # apply the schema
make logs                      # tail app logs
make down                      # stop
```

The API is served under the `/api` prefix; the Socket.IO endpoint is at `/api/socket.io/`.