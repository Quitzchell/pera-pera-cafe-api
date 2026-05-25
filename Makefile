.PHONY: up
up:
	docker compose up -d

.PHONY: build
build:
	docker compose build

.PHONY: rebuild
rebuild:
	docker compose up -d --build

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