# Quick-Start Guide

This guide shows three ways to spin up MCP-Prompts in under five minutes.

---

## 1. `npx` (local file storage)

The fastest way – **no Docker, no database, no install**.

```bash
npx -y @sparesparrow/mcp-prompts

# open a new terminal
curl http://localhost:3003/health  # → { "status": "ok" }
```

**Environment variables** (optional):

| Variable      | Default              | Description                      |
| ------------- | -------------------- | -------------------------------- |
| `PORT`        | `3003`               | HTTP port                        |
| `PROMPTS_DIR` | `~/mcp/data/prompts` | Where prompts are stored         |
| `LOG_LEVEL`   | `info`               | `debug`, `info`, `warn`, `error` |

---

## 2. Docker (file storage & persistent volume)

```bash
docker run -d --name mcp-prompts \
  -p 3003:3003 \
  -e HTTP_SERVER=true \
  -e STORAGE_TYPE=file \
  -v $(pwd)/data:/app/data \
  sparesparrow/mcp-prompts:latest
```

- Prompts & backups are persisted to `./data` on your host.
- **Note for Windows users**: In PowerShell, replace `$(pwd)` with `${PWD}`. In the classic Command Prompt, use `%CD%`.
- Stop & remove: `docker rm -f mcp-prompts`.

---

## 3. Docker Compose (PostgreSQL storage)

For multi-instance or production setups you might prefer Postgres.

`docker-compose.yml`:

```yaml
version: '3'
services:
  prompts:
    image: sparesparrow/mcp-prompts:latest
    environment:
      HTTP_SERVER: 'true'
      STORAGE_TYPE: 'postgres'
      POSTGRES_CONNECTION_STRING: 'postgresql://postgres:password@db:5432/mcp_prompts'
    depends_on: [db]
    ports: ['3003:3003']
    volumes:
      - prompts-data:/app/data
  db:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - pg-data:/var/lib/postgresql/data

volumes:
  prompts-data:
  pg-data:
```

Start services:

```bash
docker compose up -d
```

Health-check:

```bash
curl http://localhost:3003/health
```

Expect `{"status":"ok"}`.

---

## Next steps

- Explore the HTTP API (`/openapi` – coming soon).
- Read `docs/02-configuration.md` for all options.
- Join the discussion on [GitHub Issues](https://github.com/sparesparrow/mcp-prompts/issues).
