# Pera Pera Cafe

The backend of a Japanese verb conjugation trainer. A learner starts a drill round and gets prompts such as "泳ぐ → te-form", types the answer in kana or kanji, and gets instant feedback with the rule in one line (`ぐ → いで (泳ぐ → 泳いで)`). Rule groups the learner gets wrong come back sooner, through spaced repetition.

This repo is the REST API; the frontend lives in a separate repo.

## Stack

- NestJS on Node, TypeScript
- Prisma with PostgreSQL
- Jest unit tests and Supertest e2e tests
- Docker

## Running locally

Requirements: Docker, and a PostgreSQL container reachable on the external Docker network `postgres-17_default` under the hostname `postgres`.

```bash
echo 'POSTGRES_PASSWORD=<your local postgres password>' > .env
make up                      # dev server with hot reload on http://localhost:3000
docker compose run --rm --no-deps app npx prisma migrate deploy
docker compose run --rm --no-deps app npx prisma db seed
```

`APP_PORT=3001 make up` serves on another host port. After changing dependencies, run `make rebuild`.

Create a local admin (the password is read without echoing it):

```bash
read -rs ADMIN_PASSWORD && export ADMIN_PASSWORD
docker compose run --rm --no-deps -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD app npm run create-admin
unset ADMIN_PASSWORD
```

## Tests

```bash
npm test         # unit tests
make test-e2e    # e2e tests against a throwaway Postgres in Docker
npm run lint
```
