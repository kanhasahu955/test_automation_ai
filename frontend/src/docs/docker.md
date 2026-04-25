# Docker

QualityForge AI ships a complete Docker setup that you can run locally or in a
single VM. Production deployments typically use Kubernetes, but the same images
work there.

## Files

```text
qualityforge-ai/
├── docker-compose.yml          # full stack — mysql, redis, backend, worker, beat, frontend, nginx
├── backend/Dockerfile          # FastAPI image (the worker reuses this image)
├── frontend/Dockerfile         # Builds + serves the SPA via Nginx
└── nginx/                      # Production reverse proxy (optional)
```

The single compose file defines every service. The Celery worker and beat
scheduler reuse the backend image — only the `command:` differs.

## Common workflows

### Full stack (recommended)

```bash
make up           # docker compose up -d --build
make ps           # service status
make logs         # follow all containers (Ctrl+C to detach)
make down         # stop + remove (keeps volumes)
```

### Per-service operations

```bash
make logs svc=backend          # tail one service
make rebuild svc=backend       # rebuild + restart one service
make exec svc=backend          # shell into a service
make restart svc=worker        # bounce a service
make mysql-cli                 # mysql client inside the container
make redis-cli                 # redis-cli inside the container
make health                    # curl the health endpoint via Nginx
```

### Infra only (host-mode dev)

When iterating on backend code, run only data services in Docker and the API
on your host:

```bash
docker compose up -d mysql redis
make api          # uvicorn with --reload on :8000
```

This is faster for tight feedback loops than rebuilding the backend container
every change.

## Environment variables

Compose reads `backend/.env` for the backend / worker services. The recommended
pattern:

```bash
cp backend/.env.example backend/.env
# fill in DB_PASSWORD, JWT_SECRET, OPENAI_API_KEY …
```

`docker-compose.yml` injects these via `env_file:` and adds container-internal
overrides (e.g. `DATABASE_URL=mysql+pymysql://…@mysql:3306/…`) so the services
talk to each other on the `qf_net` network.

## Volumes & persistence

| Volume          | Mounted at              | Purpose                |
|-----------------|-------------------------|------------------------|
| `mysql_data`    | `/var/lib/mysql`        | Database files         |
| `qf_uploads`    | `/var/qf/uploads`       | User uploads           |
| `qf_artifacts`  | `/var/qf/artifacts`     | Generated artifacts    |

Reset everything (DESTRUCTIVE):

```bash
make up-fresh            # tear down with volumes and rebuild
make nuke                # also remove docker images
```

## Health checks

Every container has a HEALTHCHECK; verify with:

```bash
make ps
docker inspect --format='{{json .State.Health}}' qf_backend
```

## Resource hints (production)

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: "1G"
  worker:
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: "1.5G"
```

Pair with the YAML config in `backend/config/production.yaml` to size the DB
pool and worker concurrency to match your container limits — see
**Configuration** for details.

## Troubleshooting

- **`backend exited with code 1`** → almost always a missing env var. Run
  `make logs svc=backend` to confirm.
- **Slow first build** → Docker is building wheels. Subsequent builds reuse
  the layer cache.
- **Port already in use** → the compose file uses `:3307` for MySQL,
  `:6379` for Redis, `:8000` for the API, `:8080` for Nginx. Adjust
  the `ports:` mapping if any clashes with your host.
