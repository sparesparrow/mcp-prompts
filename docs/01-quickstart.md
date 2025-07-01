# Quick-Start Guide

Get MCP-Prompts running in minutes. This guide covers the fastest ways to launch the server, whether for local development, Docker, or production.

> **MCP-Prompts** is a modular, hexagonal-architecture MCP server for managing prompts, templates, and workflows. See [Overview](00-overview.md) for architecture and [Configuration](02-configuration.md) for all options.

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

- [Configuration](02-configuration.md) – All environment variables
- [API Reference](04-api-reference.md) – HTTP endpoints
- [Templates Guide](05-templates-guide.md) – Using and creating templates
- [Workflow Guide](09-workflow-guide.md) – Multi-step workflows
- [Developer Guide](07-developer-guide.md) – Contributing & development
- Join the discussion on [GitHub Issues](https://github.com/sparesparrow/mcp-prompts/issues)
