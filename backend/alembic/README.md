# Alembic Migrations

Generate the first migration after `docker compose up` once tables are created via SQLModel:

```bash
docker compose exec backend alembic revision --autogenerate -m "init"
docker compose exec backend alembic upgrade head
```

For development the app calls `SQLModel.metadata.create_all` on startup, so you can iterate
without migrations and switch to Alembic when you need versioning.
