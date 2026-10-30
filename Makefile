.PHONY: up
up:
	docker compose up -d

.PHONY: build
build:
	docker compose build

.PHONY: rebuild
rebuild:
	docker compose up -d --build --renew-anon-volumes

.PHONY: down
down:
	docker compose down

.PHONY: shell
shell:
	docker compose exec app sh

.PHONY: logs
logs:
	docker compose logs -f app

.PHONY: clean
clean:
	docker compose down --rmi local --volumes
	docker builder prune -f
# Runs against a throwaway Postgres, never the dev database.
.PHONY: test-e2e
test-e2e:
	docker network create pera-e2e >/dev/null 2>&1 || true
	docker run -d --rm --name pera-e2e-db --network pera-e2e -e POSTGRES_PASSWORD=test postgres:17-alpine >/dev/null
	docker run --rm --network pera-e2e -v "$(PWD)":/app -v pera-e2e-modules:/app/node_modules -w /app \
		-e DATABASE_URL='postgresql://postgres:test@pera-e2e-db:5432/pera_pera_cafe?schema=public' node:26-alpine \
		sh -c 'until nc -z pera-e2e-db 5432; do sleep 1; done; npm ci --no-audit --no-fund --loglevel=error && npm run test:e2e'; \
		status=$$?; docker stop pera-e2e-db >/dev/null; exit $$status
