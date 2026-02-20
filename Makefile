.PHONY: docker-up docker-up-d docker-down docker-down-v docker-build docker-logs docker-ps docker-restart

docker-up:
	docker compose up --build

docker-up-d:
	docker compose up --build -d

docker-down:
	docker compose down

docker-down-v:
	docker compose down -v

docker-build:
	docker compose build --no-cache

docker-logs:
	docker compose logs -f

docker-ps:
	docker compose ps

docker-restart:
	docker compose down && docker compose up --build -d
