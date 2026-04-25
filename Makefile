# =============================================================================
# QualityForge AI — Project Makefile
# -----------------------------------------------------------------------------
# Run `make help` to list all available targets.
# Variables can be overridden inline:  make backend-add pkg=httpx
# =============================================================================

SHELL         := /bin/bash
.DEFAULT_GOAL := help

# -- Project layout ----------------------------------------------------------
PROJECT_NAME  := qualityforge-ai
BACKEND_DIR   := backend
FRONTEND_DIR  := frontend
COMPOSE       := docker compose
COMPOSE_FILE  := docker-compose.yml

# -- Runtime knobs -----------------------------------------------------------
WORKER_QUEUES := execution,ai,stm,profiling,metadata,default
HOST          := 0.0.0.0
BACKEND_PORT  := 8000
WEB_PORT      := 5173
NGINX_PORT    := 8080

# -- Inline overrides (e.g. `make backend-add pkg=tenacity`) ----------------
pkg   ?=
name  ?=
svc   ?=
days  ?= 14

# -- Cosmetics ---------------------------------------------------------------
BLUE    := \033[36m
GREEN   := \033[32m
YELLOW  := \033[33m
RED     := \033[31m
BOLD    := \033[1m
RESET   := \033[0m

# =============================================================================
# Help
# =============================================================================
.PHONY: help
help: ## Show this help (default target)
	@printf "\n$(BOLD)$(YELLOW)QualityForge AI — Make targets$(RESET)\n\n"
	@awk 'BEGIN {FS = ":.*##"; section=""} \
		/^# ==/ {next} \
		/^# ──/ {gsub(/^# ── */, "", $$0); gsub(/ *──.*$$/, "", $$0); section=$$0; printf "$(BOLD)$(GREEN)%s$(RESET)\n", section; next} \
		/^[a-zA-Z0-9_.-]+:.*##/ {printf "  $(BLUE)%-22s$(RESET) %s\n", $$1, $$2} \
		' $(MAKEFILE_LIST)
	@printf "\n$(BOLD)Examples$(RESET)\n"
	@printf "  make setup            # one-shot bootstrap (env + deps)\n"
	@printf "  make up               # build & run full stack via Docker\n"
	@printf "  make backend-add pkg=tenacity\n"
	@printf "  make migration name=add_users_table\n"
	@printf "  make logs svc=worker\n\n"

# =============================================================================
# ── Bootstrap ──
# =============================================================================
.PHONY: setup env install
setup: env install ## Bootstrap: copy .env files + install backend & frontend deps
	@printf "$(GREEN)✓ setup complete$(RESET)\n"

env: ## Copy .env.example → .env for backend & frontend (idempotent)
	@if [ ! -f $(BACKEND_DIR)/.env ];  then cp $(BACKEND_DIR)/.env.example  $(BACKEND_DIR)/.env  && echo "  • wrote $(BACKEND_DIR)/.env";  else echo "  • $(BACKEND_DIR)/.env exists — skipping";  fi
	@if [ ! -f $(FRONTEND_DIR)/.env ]; then cp $(FRONTEND_DIR)/.env.example $(FRONTEND_DIR)/.env && echo "  • wrote $(FRONTEND_DIR)/.env"; else echo "  • $(FRONTEND_DIR)/.env exists — skipping"; fi

install: backend-install frontend-install ## Install backend (uv) + frontend (npm) deps

# -- Profile switcher (.env presets) -----------------------------------------
.PHONY: use-docker-env use-host-env which-env

use-docker-env: ## Activate compose-mode env (DB_HOST=mysql, redis://redis…)
	@cp $(BACKEND_DIR)/.env.docker $(BACKEND_DIR)/.env
	@printf "$(GREEN)✓ backend/.env now points at Docker services$(RESET)\n"
	@printf "  DB_HOST=mysql / REDIS_URL=redis://redis:6379/0\n"
	@printf "  Run:  $(BLUE)make up$(RESET)\n"

use-host-env: ## Activate host-mode env (your local MySQL on :3306, redis on :6379)
	@cp $(BACKEND_DIR)/.env.host $(BACKEND_DIR)/.env
	@printf "$(GREEN)✓ backend/.env now points at host services$(RESET)\n"
	@printf "  DB:    127.0.0.1:3306  (your locally-installed MySQL)\n"
	@printf "  Redis: redis://127.0.0.1:6379/0\n"
	@printf "\n  First-time setup:  $(BLUE)make db-create-local && make db-init$(RESET)\n"
	@printf "  Then in tabs:      $(BLUE)make api$(RESET) | $(BLUE)make worker$(RESET) | $(BLUE)make beat$(RESET) | $(BLUE)make web$(RESET)\n"

which-env: ## Show which DB/Redis the current backend/.env points at
	@printf "$(BOLD)backend/.env$(RESET)\n"
	@grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_NAME|REDIS_URL)=' $(BACKEND_DIR)/.env | sed 's/^/  /'
	@host="$$(grep -E '^DB_HOST=' $(BACKEND_DIR)/.env | cut -d= -f2)"; \
	port="$$(grep -E '^DB_PORT=' $(BACKEND_DIR)/.env | cut -d= -f2)"; \
	if [ "$$host" = "mysql" ]; then \
		printf "  $(GREEN)mode: DOCKER$(RESET) (compose service name)\n"; \
	elif [ "$$port" = "3306" ]; then \
		printf "  $(GREEN)mode: HOST$(RESET) (your locally-installed MySQL)\n"; \
	elif [ "$$port" = "3307" ]; then \
		printf "  $(GREEN)mode: HOST→DOCKER$(RESET) (host process talking to compose mysql)\n"; \
	else \
		printf "  $(YELLOW)mode: CUSTOM$(RESET)\n"; \
	fi

# -- Lightweight infra-only stack (host-mode dev companion) ------------------
.PHONY: infra-up infra-down
infra-up: ## Run only mysql + redis containers (compose mysql exposed on :3307)
	$(COMPOSE) up -d mysql redis
	@printf "$(GREEN)✓ Compose MySQL on 127.0.0.1:3307 / Redis on 127.0.0.1:6379$(RESET)\n"
	@printf "  Note: this is the *dockerized* MySQL on port 3307. To use this from\n"
	@printf "  host mode, set DB_PORT=3307 in backend/.env.host before make api.\n"

infra-down: ## Stop the infra-only stack
	$(COMPOSE) stop mysql redis

# -- Local MySQL bootstrap (host mode) ---------------------------------------
.PHONY: db-create-local db-init db-ping
MYSQL_LOCAL_HOST          ?= 127.0.0.1
MYSQL_LOCAL_PORT          ?= 3306
MYSQL_LOCAL_ROOT_USER     ?= root
MYSQL_LOCAL_ROOT_PASSWORD ?=

db-create-local: ## Create qualityforge DB + qfuser in your locally-installed MySQL
	@if ! command -v mysql >/dev/null 2>&1; then \
		printf "$(RED)mysql CLI not found.$(RESET) Install MySQL first:\n"; \
		printf "  brew install mysql && brew services start mysql\n"; \
		exit 1; \
	fi
	@printf "$(BLUE)→ Running backend/sql/init/01_create_database.sql against $(MYSQL_LOCAL_HOST):$(MYSQL_LOCAL_PORT) as $(MYSQL_LOCAL_ROOT_USER)$(RESET)\n"
	@if [ -z "$(MYSQL_LOCAL_ROOT_PASSWORD)" ]; then \
		mysql -h $(MYSQL_LOCAL_HOST) -P $(MYSQL_LOCAL_PORT) -u $(MYSQL_LOCAL_ROOT_USER) < $(BACKEND_DIR)/sql/init/01_create_database.sql; \
	else \
		mysql -h $(MYSQL_LOCAL_HOST) -P $(MYSQL_LOCAL_PORT) -u $(MYSQL_LOCAL_ROOT_USER) -p$(MYSQL_LOCAL_ROOT_PASSWORD) < $(BACKEND_DIR)/sql/init/01_create_database.sql; \
	fi
	@printf "$(GREEN)✓ qualityforge DB + qfuser ready$(RESET)\n"
	@printf "  Next:  $(BLUE)make db-init$(RESET)  (creates tables + admin user)\n"

db-init: ## Create tables in the active DB (works for host AND docker modes)
	@if [ -d $(BACKEND_DIR)/.venv ]; then \
		cd $(BACKEND_DIR) && uv run python -m scripts.db_bootstrap init; \
	elif $(COMPOSE) ps backend 2>/dev/null | grep -q "Up"; then \
		$(COMPOSE) exec backend python -m scripts.db_bootstrap init; \
	else \
		printf "$(RED)No backend venv and no running backend container.$(RESET)\n"; \
		printf "  Run:  $(BLUE)make backend-install$(RESET)  or  $(BLUE)make up$(RESET)\n"; \
		exit 1; \
	fi

db-ping: ## Ping the active DB and report mode + version + table count
	@if [ -d $(BACKEND_DIR)/.venv ]; then \
		cd $(BACKEND_DIR) && uv run python -m scripts.db_bootstrap ping; \
	elif $(COMPOSE) ps backend 2>/dev/null | grep -q "Up"; then \
		$(COMPOSE) exec backend python -m scripts.db_bootstrap ping; \
	else \
		printf "$(RED)No backend venv and no running backend container.$(RESET)\n"; \
		exit 1; \
	fi

# =============================================================================
# ── Backend (uv) ──
# =============================================================================
.PHONY: backend-install backend api worker beat flower celery-status backend-test backend-lint backend-format backend-typecheck backend-shell backend-add backend-add-dev backend-remove backend-update backend-outdated

backend-install: ## Install backend deps from uv.lock (frozen)
	cd $(BACKEND_DIR) && uv sync --frozen

backend: api ## Alias for `api`
api: ## Run FastAPI + Socket.IO dev server (uvicorn --reload)
	cd $(BACKEND_DIR) && uv run uvicorn app.main:asgi_app --reload --host $(HOST) --port $(BACKEND_PORT)

worker: ## Run Celery worker (all queues)
	cd $(BACKEND_DIR) && uv run celery -A app.core.celery_app.celery_app worker -l info -Q $(WORKER_QUEUES)

beat: ## Run Celery beat scheduler (RedBeat — dynamic schedules)
	cd $(BACKEND_DIR) && uv run celery -A app.core.celery_app.celery_app beat --scheduler redbeat.RedBeatScheduler -l info

flower: ## Run Flower (Celery monitoring UI on :5555) — host mode
	@broker="$$(grep -E '^CELERY_BROKER_URL=' $(BACKEND_DIR)/.env | cut -d= -f2-)"; \
	if [ -z "$$broker" ]; then broker="redis://127.0.0.1:6379/1"; fi; \
	if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^qf_flower$$'; then \
		printf "$(RED)✗ docker container qf_flower is already on :5555$(RESET)\n"; \
		printf "  Stop it first:  $(BLUE)make ops-down$(RESET)\n"; \
		printf "  (Otherwise the browser will keep showing the docker Flower,\n"; \
		printf "   which talks to the docker-network Redis — not the host one\n"; \
		printf "   your worker is registered with, so workers look 'Offline'.)\n"; \
		exit 1; \
	fi; \
	printf "$(GREEN)→ Flower (host)$(RESET)\n"; \
	printf "  broker : $$broker\n"; \
	printf "  ui     : http://localhost:5555\n\n"; \
	cd $(BACKEND_DIR) && uv run celery -A app.core.celery_app.celery_app flower --port=5555 --address=0.0.0.0

celery-status: ## Ping the celery worker against the active .env broker
	@broker="$$(grep -E '^CELERY_BROKER_URL=' $(BACKEND_DIR)/.env | cut -d= -f2-)"; \
	printf "$(BOLD)Celery status$(RESET)\n"; \
	printf "  broker (active .env) : %s\n" "$$broker"; \
	if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^qf_flower$$'; then \
		printf "  $(YELLOW)docker qf_flower is running$(RESET) — it monitors the docker-network Redis\n"; \
		printf "  open http://localhost:5555 only when the docker stack is up (make up)\n"; \
	fi; \
	printf "\n→ inspect ping (10s timeout)\n"; \
	cd $(BACKEND_DIR) && uv run celery -A app.core.celery_app.celery_app inspect ping --timeout=10 || \
		(printf "\n$(RED)No worker responded.$(RESET)  Is $(BLUE)make worker$(RESET) running with this same broker?\n" && exit 1)

backend-test: ## Run backend tests (pytest)
	cd $(BACKEND_DIR) && uv run pytest

backend-lint: ## Lint backend with ruff
	cd $(BACKEND_DIR) && uv run ruff check .

backend-format: ## Auto-format backend with ruff
	cd $(BACKEND_DIR) && uv run ruff format . && uv run ruff check --fix .

backend-typecheck: ## Type-check backend with mypy
	cd $(BACKEND_DIR) && uv run mypy app

backend-shell: ## Open a Python REPL inside the backend env
	cd $(BACKEND_DIR) && uv run python

backend-add: ## Add a runtime dep:  make backend-add pkg=httpx
	@if [ -z "$(pkg)" ]; then echo "$(RED)Usage: make backend-add pkg=<package>$(RESET)"; exit 1; fi
	cd $(BACKEND_DIR) && uv add "$(pkg)"

backend-add-dev: ## Add a dev dep:      make backend-add-dev pkg=pytest-mock
	@if [ -z "$(pkg)" ]; then echo "$(RED)Usage: make backend-add-dev pkg=<package>$(RESET)"; exit 1; fi
	cd $(BACKEND_DIR) && uv add --dev "$(pkg)"

backend-remove: ## Remove a dep:        make backend-remove pkg=ujson
	@if [ -z "$(pkg)" ]; then echo "$(RED)Usage: make backend-remove pkg=<package>$(RESET)"; exit 1; fi
	cd $(BACKEND_DIR) && uv remove "$(pkg)"

backend-update: ## Refresh / upgrade backend lockfile (all packages)
	cd $(BACKEND_DIR) && uv lock --upgrade

backend-outdated: ## Show outdated backend dependencies
	cd $(BACKEND_DIR) && uv pip list --outdated

# =============================================================================
# ── Frontend (npm + vite) ──
# =============================================================================
.PHONY: frontend-install frontend web frontend-build frontend-preview frontend-lint frontend-typecheck frontend-add frontend-add-dev

frontend-install: ## Install frontend deps (npm install)
	cd $(FRONTEND_DIR) && npm install

frontend: web ## Alias for `web`
web: ## Run Vite dev server (port 5173)
	cd $(FRONTEND_DIR) && npm run dev -- --host $(HOST) --port $(WEB_PORT)

frontend-build: ## Production build of the SPA
	cd $(FRONTEND_DIR) && npm run build

frontend-preview: ## Preview production build locally
	cd $(FRONTEND_DIR) && npm run preview

frontend-lint: ## Lint frontend with eslint
	cd $(FRONTEND_DIR) && npm run lint

frontend-typecheck: ## Type-check frontend with tsc
	cd $(FRONTEND_DIR) && npm run typecheck

frontend-add: ## Add a runtime dep:  make frontend-add pkg=clsx
	@if [ -z "$(pkg)" ]; then echo "$(RED)Usage: make frontend-add pkg=<package>$(RESET)"; exit 1; fi
	cd $(FRONTEND_DIR) && npm install "$(pkg)"

frontend-add-dev: ## Add a dev dep:      make frontend-add-dev pkg=vitest
	@if [ -z "$(pkg)" ]; then echo "$(RED)Usage: make frontend-add-dev pkg=<package>$(RESET)"; exit 1; fi
	cd $(FRONTEND_DIR) && npm install -D "$(pkg)"

# =============================================================================
# ── Docker stack ──
# =============================================================================
.PHONY: up up-fresh down stop start restart ps logs logs-backend logs-worker logs-frontend logs-mysql build rebuild pull exec mysql-cli redis-cli health

up: ## Build & start the full stack in background
	$(COMPOSE) up -d --build

up-fresh: down ## Tear down (with volumes!) and rebuild
	$(COMPOSE) down -v --remove-orphans
	$(COMPOSE) up -d --build

down: ## Stop & remove containers (keeps volumes)
	$(COMPOSE) down

stop: ## Stop containers (keep them)
	$(COMPOSE) stop

start: ## Start previously-stopped containers
	$(COMPOSE) start

restart: ## Restart a service:    make restart svc=backend
	@if [ -z "$(svc)" ]; then $(COMPOSE) restart; else $(COMPOSE) restart $(svc); fi

ps: ## Show service status
	$(COMPOSE) ps

logs: ## Tail logs (all or one):   make logs svc=worker
	@if [ -z "$(svc)" ]; then $(COMPOSE) logs -f --tail=200; else $(COMPOSE) logs -f --tail=200 $(svc); fi

logs-backend: ## Tail backend logs
	$(COMPOSE) logs -f --tail=200 backend

logs-worker: ## Tail worker logs
	$(COMPOSE) logs -f --tail=200 worker

logs-frontend: ## Tail frontend logs
	$(COMPOSE) logs -f --tail=200 frontend

logs-mysql: ## Tail MySQL logs
	$(COMPOSE) logs -f --tail=200 mysql

build: ## Build images (no start)
	$(COMPOSE) build

rebuild: ## Rebuild a single service: make rebuild svc=backend
	@if [ -z "$(svc)" ]; then echo "$(RED)Usage: make rebuild svc=<service>$(RESET)"; exit 1; fi
	$(COMPOSE) build --no-cache $(svc)
	$(COMPOSE) up -d $(svc)

pull: ## Pull all upstream images
	$(COMPOSE) pull

exec: ## Exec a shell in a service:  make exec svc=backend
	@if [ -z "$(svc)" ]; then echo "$(RED)Usage: make exec svc=<service>  (e.g. backend, worker, mysql)$(RESET)"; exit 1; fi
	$(COMPOSE) exec $(svc) /bin/sh

mysql-cli: ## Open MySQL CLI inside the qf_mysql container
	$(COMPOSE) exec mysql mysql -uroot -p$${MYSQL_ROOT_PASSWORD:-rootpass} $${MYSQL_DATABASE:-qualityforge}

redis-cli: ## Open redis-cli inside qf_redis
	$(COMPOSE) exec redis redis-cli

health: ## Hit the API health endpoint via Nginx
	@curl -fsS http://localhost:$(NGINX_PORT)/api/v1/health && echo "" || echo "$(RED)API not reachable on :$(NGINX_PORT)$(RESET)"

# =============================================================================
# ── Operations dashboards (Flower / Redis Commander / Airflow) ──
# =============================================================================
.PHONY: ops-up ops-down ops-status flower-docker redis-ui airflow-up airflow-down airflow-logs

ops-up: ## Start Flower + Redis Commander (compose profile=ops)
	$(COMPOSE) --profile ops up -d flower redis-commander
	@printf "$(GREEN)Flower:$(RESET)         http://localhost:5555\n"
	@printf "$(GREEN)Redis Commander:$(RESET) http://localhost:8081 (user/pass: admin/admin)\n"
	@if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^qf_redis$$'; then \
		printf "\n$(YELLOW)⚠ qf_redis container is not running.$(RESET)\n"; \
		printf "  Docker Flower talks to redis://redis:6379/1 (docker network only) —\n"; \
		printf "  it will show $(BOLD)0 workers / Offline$(RESET) until you also run $(BLUE)make up$(RESET).\n"; \
		printf "  If you're running celery on the host instead, stop these dashboards\n"; \
		printf "  ($(BLUE)make ops-down$(RESET)) and use $(BLUE)make flower$(RESET) on the host.\n"; \
	fi

ops-down: ## Stop the optional ops stack
	$(COMPOSE) --profile ops stop flower redis-commander

ops-status: ## Show status of ops dashboards
	$(COMPOSE) --profile ops ps flower redis-commander

flower-docker: ## Start ONLY Flower in the docker stack (Celery monitor UI)
	$(COMPOSE) --profile ops up -d flower
	@printf "$(GREEN)Flower:$(RESET) http://localhost:5555\n"

redis-ui: ## Start ONLY Redis Commander
	$(COMPOSE) --profile ops up -d redis-commander
	@printf "$(GREEN)Redis Commander:$(RESET) http://localhost:8081 (admin/admin)\n"

airflow-up: ## Start optional Airflow stack (standalone, on :8088)
	@$(COMPOSE) ps redis >/dev/null 2>&1 || { echo "$(YELLOW)Bring core stack up first: make up$(RESET)"; exit 1; }
	$(COMPOSE) -f docker-compose.airflow.yml up -d
	@printf "$(GREEN)Airflow:$(RESET) http://localhost:8088 (admin/admin)\n"
	@printf "  • DAGs are mounted from backend/app/airflow_dags/\n"
	@printf "  • First boot takes ~60s — check logs:  make airflow-logs\n"

airflow-down: ## Stop optional Airflow stack
	$(COMPOSE) -f docker-compose.airflow.yml down

airflow-logs: ## Tail Airflow logs
	$(COMPOSE) -f docker-compose.airflow.yml logs -f --tail=200 airflow

# =============================================================================
# ── Database (alembic) ──
# =============================================================================
.PHONY: migrate migration db-current db-history db-downgrade db-reset

migrate: ## Apply migrations (host or container if available)
	@if [ -d $(BACKEND_DIR)/.venv ]; then \
		echo "→ alembic upgrade head (host)"; \
		cd $(BACKEND_DIR) && uv run alembic upgrade head; \
	else \
		echo "→ alembic upgrade head (container)"; \
		$(COMPOSE) exec backend alembic upgrade head; \
	fi

migration: ## Create a new revision:  make migration name=add_xyz
	@if [ -z "$(name)" ]; then echo "$(RED)Usage: make migration name=<slug>$(RESET)"; exit 1; fi
	@if [ -d $(BACKEND_DIR)/.venv ]; then \
		cd $(BACKEND_DIR) && uv run alembic revision --autogenerate -m "$(name)"; \
	else \
		$(COMPOSE) exec backend alembic revision --autogenerate -m "$(name)"; \
	fi

db-current: ## Show current alembic revision
	@if [ -d $(BACKEND_DIR)/.venv ]; then cd $(BACKEND_DIR) && uv run alembic current; else $(COMPOSE) exec backend alembic current; fi

db-history: ## Show alembic history
	@if [ -d $(BACKEND_DIR)/.venv ]; then cd $(BACKEND_DIR) && uv run alembic history --verbose; else $(COMPOSE) exec backend alembic history --verbose; fi

db-downgrade: ## Downgrade by one revision (host or container)
	@if [ -d $(BACKEND_DIR)/.venv ]; then cd $(BACKEND_DIR) && uv run alembic downgrade -1; else $(COMPOSE) exec backend alembic downgrade -1; fi

db-reset: ## DESTRUCTIVE: drop volumes & re-run migrations
	@printf "$(RED)This will DELETE the MySQL volume. Continue? [y/N] $(RESET)"; \
	read ans && [ "$$ans" = "y" ] || { echo "aborted"; exit 1; }
	$(COMPOSE) down -v
	$(COMPOSE) up -d mysql redis
	@sleep 8
	$(COMPOSE) up -d backend
	@sleep 4
	$(COMPOSE) exec backend alembic upgrade head

# =============================================================================
# ── Quality (lint / format / test across stack) ──
# =============================================================================
.PHONY: lint format test typecheck ci

lint: backend-lint frontend-lint ## Lint backend + frontend

format: backend-format ## Auto-format backend (frontend uses prettier-on-save)

test: backend-test ## Run backend tests (frontend has no test runner yet)

typecheck: backend-typecheck frontend-typecheck ## Type-check backend (mypy) + frontend (tsc)

ci: lint typecheck test ## Full local CI: lint + typecheck + test

# =============================================================================
# ── Utilities ──
# =============================================================================
.PHONY: docs reports postman openapi excel-docs

docs: ## Open the docs folder (diagrams + Postman collection)
	@echo "Diagrams: assets/01..11"
	@ls docs

postman: ## Print Postman collection paths
	@echo "Collection: docs/qualityforge-ai.postman_collection.json"
	@echo "Environment: docs/qualityforge-ai.postman_environment.json"

openapi: ## Fetch and pretty-print the live OpenAPI spec
	@curl -fsS http://localhost:$(NGINX_PORT)/api/openapi.json | python -m json.tool | head -60

excel-docs: ## Regenerate API / STM / schedule Excel workbooks under docs/excel
	@cd $(BACKEND_DIR) && uv run python -m scripts.build_excel_docs

reports: ## Quick KPI dump (project_id=ID)
	@if [ -z "$(project_id)" ]; then echo "$(RED)Usage: make reports project_id=<id>$(RESET)"; exit 1; fi
	@curl -fsS -H "Authorization: Bearer $$QF_TOKEN" \
	  http://localhost:$(NGINX_PORT)/api/v1/projects/$(project_id)/dashboard | python -m json.tool

# =============================================================================
# ── Cleanup ──
# =============================================================================
.PHONY: clean clean-backend clean-frontend clean-docker nuke

clean: clean-backend clean-frontend ## Remove caches, .venv, node_modules, dist
	@echo "$(GREEN)✓ workspace cleaned$(RESET)"

clean-backend: ## Remove backend caches & venv
	@cd $(BACKEND_DIR) && rm -rf .venv .pytest_cache .mypy_cache .ruff_cache .coverage htmlcov
	@find $(BACKEND_DIR) -type d -name '__pycache__' -prune -exec rm -rf {} +
	@echo "  • backend caches removed"

clean-frontend: ## Remove frontend node_modules & dist
	@cd $(FRONTEND_DIR) && rm -rf node_modules dist .vite
	@echo "  • frontend artefacts removed"

clean-docker: ## Stop stack and remove orphans (keeps volumes)
	$(COMPOSE) down --remove-orphans

nuke: ## DESTRUCTIVE: clean everything incl. docker volumes & images
	@printf "$(RED)This will DELETE volumes and images. Continue? [y/N] $(RESET)"; \
	read ans && [ "$$ans" = "y" ] || { echo "aborted"; exit 1; }
	$(COMPOSE) down -v --remove-orphans --rmi local
	$(MAKE) clean
