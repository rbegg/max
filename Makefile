# Makefile for managing Docker Compose environments

DEV_COMPOSE = docker compose -p max-dev -f docker-compose.yaml -f docker-compose.dev.yaml
PROD_COMPOSE = docker compose -p max-prod -f docker-compose.yaml -f docker-compose.prod.yaml

# --- Development Commands ---

## Build and start the development containers
dev:
	$(DEV_COMPOSE) up --build

## Stop the development containers
dev-down:
	$(DEV_COMPOSE) down

## Get an interactive shell inside the running dev container
dev-stt-shell:
	$(DEV_COMPOSE) exec max-dev-max-stt bash

	## Get an interactive shell inside the running dev container
dev-max-shell:
	$(DEV_COMPOSE) exec max ash

## Get an interactive shell inside the running dev container
dev-ollama-shell:
	$(DEV_COMPOSE) exec ollama bash

# --- Production Commands ---

## Build and start the production containers in detached mode
prod:
	$(PROD_COMPOSE) up --build -d

## Stop the production containers
prod-down:
	$(PROD_COMPOSE) down

prod-logs:
	docker logs -f stt-prod

prod-shell:
	docker exec -it stt-prod bash
# --- Utility Commands ---

## Stop all containers and remove volumes (cleans the cache)
clean:
	$(DEV_COMPOSE) down -v
	$(PROD_COMPOSE) down -v

.PHONY: dev dev-down dev-shell prod prod-down clean
