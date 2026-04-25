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

use-host-env: ## Activate host-mode env (DB on 127.0.0.1:3307, redis on :6379)
	@cp $(BACKEND_DIR)/.env.host $(BACKEND_DIR)/.env
	@printf "$(GREEN)✓ backend/.env now points at host services$(RESET)\n"
	@printf "  DB_HOST=127.0.0.1:3307 / REDIS_URL=redis://127.0.0.1:6379/0\n"
	@printf "  Bring infra up:   $(BLUE)make infra-up$(RESET)\n"
	@printf "  Then in tabs:     $(BLUE)make api$(RESET) | $(BLUE)make worker$(RESET) | $(BLUE)make beat$(RESET) | $(BLUE)make web$(RESET)\n"

which-env: ## Show which mode the current backend/.env is configured for
	@grep -E '^DB_HOST=' $(BACKEND_DIR)/.env | sed 's/^/  /'
	@grep -E '^REDIS_URL=' $(BACKEND_DIR)/.env | sed 's/^/  /'

# -- Lightweight infra-only stack (host-mode dev companion) ------------------
.PHONY: infra-up infra-down
infra-up: ## Run only mysql + redis containers (for host-mode dev)
	$(COMPOSE) up -d mysql redis
	@printf "$(GREEN)✓ MySQL on 127.0.0.1:3307 / Redis on 127.0.0.1:6379$(RESET)\n"

infra-down: ## Stop the infra-only stack
	$(COMPOSE) stop mysql redis

# =============================================================================
# ── Backend (uv) ──
# =============================================================================
.PHONY: backend-install backend api worker beat backend-test backend-lint backend-format backend-typecheck backend-shell backend-add backend-add-dev backend-remove backend-update backend-outdated

backend-install: ## Install backend deps from uv.lock (frozen)
	cd $(BACKEND_DIR) && uv sync --frozen

backend: api ## Alias for `api`
api: ## Run FastAPI dev server (uvicorn --reload)
	cd $(BACKEND_DIR) && uv run uvicorn app.main:app --reload --host $(HOST) --port $(BACKEND_PORT)

worker: ## Run Celery worker (all queues)
	cd $(BACKEND_DIR) && uv run celery -A app.core.celery_app.celery_app worker -l info -Q $(WORKER_QUEUES)

beat: ## Run Celery beat scheduler (RedBeat — dynamic schedules)
	cd $(BACKEND_DIR) && uv run celery -A app.core.celery_app.celery_app beat --scheduler redbeat.RedBeatScheduler -l info

flower: ## Run Flower (Celery monitoring UI on :5555)
	cd $(BACKEND_DIR) && uv run celery -A app.core.celery_app.celery_app flower --port=5555 --address=0.0.0.0

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
