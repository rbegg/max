# Makefile for managing Docker Compose environments

# Define the version
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)
GIT_HASH   := $(shell git rev-parse --short HEAD)
export APP_VERSION := $(GIT_BRANCH)-$(GIT_HASH)



DEV_COMPOSE = docker compose --env-file .env.dev -f docker-compose.yaml -f docker-compose.dev.yaml
PROD_COMPOSE = docker compose --env-file .env -f docker-compose.yaml -f docker-compose.prod.yaml

# Always include logging for down cmds
DEV_COMPOSE_LOG = $(DEV_COMPOSE) -f docker-compose.logging.yaml
PROD_COMPOSE_LOG = $(PROD_COMPOSE) -f docker-compose.logging.yaml

# export LOG=1 to enable logging services
ifdef LOG
	DEV_COMPOSE += -f docker-compose.logging.yaml
	PROD_COMPOSE += -f docker-compose.logging.yaml
endif

# --- Development Commands ---
echo:
	@echo "APP_VERSION = " $(APP_VERSION)
	@echo "DEV CMD     = " $(DEV_COMPOSE)
	@echo "PROD CMD    = " $(PROD_COMPOSE)


## Build and start the development containers
dev:
	$(DEV_COMPOSE) up --build

a-test:
	$(DEV_COMPOSE) up ollama neo4j --build

## Stop the development containers
dev-down:
	$(DEV_COMPOSE_LOG) down

# --- Production Commands ---

## Build and start the production containers in detached mode
prod:
	$(PROD_COMPOSE) up --build -d

## Stop the production containers
prod-down:
	$(PROD_COMPOSE_LOG) down

logs:
	docker logs -f

logs-ui:
	@echo "---"
	@echo "🔍 Starting Grafana and Loki services..."
	@echo "Access Grafana at: http://localhost:3000"
	@echo "---"
	$(PROD_COMPOSE) up -d loki grafana

# --- Utility Commands ---

## Stop all containers and remove volumes (cleans the cache)
clean:
	$(DEV_COMPOSE) down -v
	$(PROD_COMPOSE) down -v

.PHONY: dev dev-down dev-shell prod prod-down clean
