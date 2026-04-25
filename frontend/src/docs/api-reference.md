# API Reference

The QualityForge backend exposes a versioned REST API at `/api/v1`. The full
interactive spec is at <http://localhost:8000/docs> (OpenAPI / Swagger UI).
Below are the conventions every endpoint follows.

## Authentication

JWT access tokens with refresh-token rotation.

| Endpoint                         | Method | Body                          |
|----------------------------------|--------|-------------------------------|
| `/api/v1/auth/register`          | POST   | `{ name, email, password }`   |
| `/api/v1/auth/login-json`        | POST   | `{ email, password }`         |
| `/api/v1/auth/refresh`           | POST   | `{ refresh_token }`           |
| `/api/v1/auth/logout`            | POST   | `{ refresh_token }`           |
| `/api/v1/auth/me`                | GET    | —                             |

Send the access token as `Authorization: Bearer <token>` on every protected
endpoint. The frontend `TokenStore` does this automatically and refreshes
silently on 401.

## Common request/response shape

Successful response:

```json
{
  "data": { "...": "..." },
  "meta": { "request_id": "01J..." }
}
```

List response (paginated):

```json
{
  "data": [ /* items */ ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 137,
    "total_pages": 7,
    "request_id": "01J..."
  }
}
```

Error response:

```json
{
  "error": {
    "code": "validation_error",
    "message": "field 'name' is required",
    "details": [ /* field-level errors */ ]
  },
  "meta": { "request_id": "01J..." }
}
```

## Pagination

Use `?page=1&page_size=20`. Every list endpoint accepts these. `page_size` is
clamped to a reasonable max (default 100).

## Filtering & sorting

- **Filtering** — query params named after fields, e.g. `?status=active&priority=high`.
- **Sorting** — `?sort=-created_at` (descending) or `?sort=name` (ascending).
- **Search** — `?q=login` (full-text where supported).

## Idempotency

Any **POST** that creates a resource accepts an optional
`Idempotency-Key` header. The backend will return the same response for the
same key for 24h.

```http
POST /api/v1/executions
Idempotency-Key: 01HZ...
Content-Type: application/json
```

## Versioning

Breaking changes ship under `/api/v2`. We never break `v1` after release;
deprecations are announced in the release notes and surfaced as
`Deprecation` and `Sunset` response headers.

## Rate limits

Default per-user limits (configurable in `base.yaml`):

| Bucket            | Limit         |
|-------------------|---------------|
| Auth endpoints    | 10 req / sec  |
| Read endpoints    | 60 req / sec  |
| Write endpoints   | 20 req / sec  |
| AI endpoints      | 4  req / sec  |

Excess requests get `429 Too Many Requests` with a `Retry-After` header.

## Postman collection

The repo ships a Postman collection + environment under `docs/`:

```text
docs/qualityforge-ai.postman_collection.json
docs/qualityforge-ai.postman_environment.json
```

Import both, set `base_url` to your local server, and run the **Auth → login**
request first to populate the access token.
