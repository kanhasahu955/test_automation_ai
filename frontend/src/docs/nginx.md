# Nginx

Nginx fronts the QualityForge stack in production. It terminates TLS, serves
the React build, and reverse-proxies API traffic to the FastAPI backend.

## Topology

```text
                    Internet
                       │
                       ▼
                ┌──────────────┐
                │    Nginx     │   :443  TLS terminator + static files
                └──────┬───────┘
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
   /  static    /api  → backend   /docs → openapi
   (React build)  :8000             :8000
```

## Reference config

`nginx/default.conf` (shipped in the repo):

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain application/json text/css application/javascript;

    # ---- React static build --------------------------------------
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # ---- Reverse proxy → FastAPI ---------------------------------
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location /docs {
        proxy_pass http://backend:8000/docs;
    }
    location /openapi.json {
        proxy_pass http://backend:8000/openapi.json;
    }

    # ---- Health probe --------------------------------------------
    location = /healthz {
        access_log off;
        return 200 "ok\n";
    }
}
```

## TLS

For production, terminate TLS at Nginx. The simplest path:

```bash
docker run --rm \
  -v "$(pwd)/letsencrypt:/etc/letsencrypt" \
  -p 80:80 \
  certbot/certbot certonly --standalone -d quality.example.com
```

Then mount `/etc/letsencrypt` into the Nginx container and add:

```nginx
listen 443 ssl http2;
ssl_certificate     /etc/letsencrypt/live/quality.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/quality.example.com/privkey.pem;
```

## Hardening checklist

- `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`
- `add_header X-Frame-Options "DENY";`
- `add_header X-Content-Type-Options "nosniff";`
- `add_header Referrer-Policy "no-referrer-when-downgrade";`
- Rate-limit `/api/auth/`:
  ```nginx
  limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/s;
  location /api/auth/ {
      limit_req zone=auth burst=20 nodelay;
      proxy_pass http://backend:8000;
  }
  ```
- Forward request IDs: `proxy_set_header X-Request-ID $request_id;`
  (the FastAPI app picks these up for structured logs.)

## Local usage

Nginx is one of the services in the main `docker-compose.yml`, so:

```bash
make up                       # full stack — including Nginx on :8080
make logs svc=nginx           # tail nginx logs
make health                   # curl /healthz via Nginx
```

For dev work you almost never need Nginx — Vite proxies API calls in
`vite.config.ts`. Use Nginx for staging / production-like setups.
