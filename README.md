# MCP Prompts Server

[![build](https://img.shields.io/github/actions/workflow/status/sparesparrow/mcp-prompts/ci.yml?branch=main)](https://github.com/sparesparrow/mcp-prompts/actions)
[![license](https://img.shields.io/github/license/sparesparrow/mcp-prompts.svg)](LICENSE)
[![codecov](https://codecov.io/gh/sparesparrow/mcp-prompts/branch/main/graph/badge.svg)](https://codecov.io/gh/sparesparrow/mcp-prompts)

A lightweight, extensible server for managing prompts and templates in the Model Context Protocol (MCP) ecosystem. **Store prompts once, version them, and retrieve them on demand.**

---

## Why MCP-Prompts?

* 🔌 **Pluggable storage** – file-system, PostgreSQL, MDC (Cursor Rules), and more coming.
* 🧩 **Composable** – expose prompts as MCP resources or HTTP/SSE endpoints.
* 🚀 **Instant setup** – run locally with _npx_ or in the cloud with Docker.
* 🛠️ **Dev-friendly** – JSON schema validation, typed SDK, comprehensive tests.
* 📜 **Open licence & community focused** – contributions welcome!

---

## 30-Second Quick-Start

### 1. Using npx (no dependencies)
```bash
npx -y @sparesparrow/mcp-prompts
curl http://localhost:3003/health   # → { "status": "ok" }
```

### 2. Using Docker (persistent volume)
```bash
docker run -d --name mcp-prompts \
  -p 3003:3003 \
  -e HTTP_SERVER=true \
  -e STORAGE_TYPE=file \
  -v $(pwd)/data:/app/data \
  sparesparrow/mcp-prompts:latest
```

### 3. Docker Compose (PostgreSQL)
Create a `docker-compose.yml` file:
```yaml
version: "3"
services:
  prompts:
    image: sparesparrow/mcp-prompts:latest
    environment:
      HTTP_SERVER: "true"
      STORAGE_TYPE: "postgres"
      POSTGRES_CONNECTION_STRING: "postgresql://postgres:password@db:5432/mcp_prompts"
    ports: [ "3003:3003" ]
    depends_on: [ db ]
  db:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
```
Then run:
```bash
docker compose up -d
curl http://localhost:3003/health
```

---

## Implemented vs Planned Features

| Feature | Status | Notes |
| --- | :---: | --- |
| File storage adapter | ✅ | stable |
| Memory storage adapter | ✅ | stable, for testing/dev |
| PostgreSQL adapter (+ embeddings) | ✅ | since v1.2.x |
| MDC adapter (Cursor Rules) | ⚠️ | experimental, available in main branch |
| HTTP server + SSE | ⚠️ | experimental |
| ElasticSearch adapter | 🛠️ | v1.3 roadmap |
| Orchestrator integration | 🛠️ | concept |
| Mermaid diagram server | 🛠️ | concept |

Legend: ✅ stable · ⚠️ experimental · 🛠️ in progress

---

## Documentation

This README is intentionally concise. Full documentation lives in the `docs/` directory:

| Path | What you will find there |
| --- | --- |
| `docs/00-overview.md` | Detailed project overview & motivation |
| `docs/01-quickstart.md` | The same quick-start plus advanced tips |
| `docs/02-configuration.md` | All environment variables & CLI flags |
| `docs/03-storage-adapters.md` | File, Postgres, MDC, and upcoming adapters |
| `docs/04-api-reference.md` | Tool & HTTP API reference (WIP) |
| `docs/05-templates-guide.md` | Variables, apply, export, best practices |
| `docs/06-mcp-integration.md` | Multi-server scenarios, router, SSE |
| `docs/07-developer-guide.md` | Contributing, tests, release process |
| `docs/08-roadmap.md` | Planned features & milestones |

> ℹ️ Legacy content from the previous long README has been preserved at `docs/LEGACY_README.md` until the migration is complete.

---

## User Guides

- [How to use MCP-Prompts with Claude Desktop and Cursor IDE (English)](./USER_GUIDE.md)
- [Jak používat MCP-Prompts s Claude Desktop a Cursor IDE (česky)](./USER_GUIDE-cs.md)

---

## Contributing

We love contributions! Please read `CONTRIBUTING.md` for the workflow, coding style, and how to run the test suite.

---

## License

Distributed under the MIT license. See `LICENSE` for more information.

---

## Using the MDC (Cursor Rules) Adapter

To use the MDC adapter for storage (experimental):

```
STORAGE_TYPE=mdc
MDC_RULES_DIR=./.cursor/rules
```

Or with Docker:

```
docker run -d --name mcp-prompts \
  -p 3003:3003 \
  -e HTTP_SERVER=true \
  -e STORAGE_TYPE=mdc \
  -e MDC_RULES_DIR=/.cursor/rules \
  -v $(pwd)/.cursor/rules:/.cursor/rules \
  sparesparrow/mcp-prompts:latest
```

See `docs/03-storage-adapters.md` for details.

---

## TODOs: Roadmap & Quality Improvements

This list contains current tasks and suggestions for further development and quality improvement.

### 1. Feature Expansion & Stabilization
- [ ] Stabilize and document the MDC (Cursor Rules) adapter
- [ ] Expand support for new MCP clients (LM Studio, LibreChat, Tasker, Android, etc.)
- [ ] Add and extend user guides (EN, CZ) for all supported clients and integrations
- [ ] Add advanced workflow and prompt usage examples

### 2. Testing & CI/CD
- [ ] Ensure high test coverage (unit, integration, E2E)
- [ ] Regularly run CI pipeline (lint, tests, build, validation, audit)
- [ ] Add tests for MDC adapter and new storage backends
- [ ] Automate CLI and API tests

### 3. Documentation & Clarity
- [ ] Keep README and user guides concise and up to date
- [ ] Add/update README files in all key directories (`scripts/`, `legacy/`, `examples/`, `docker/scripts/`)
- [ ] Add detailed examples, FAQ, and troubleshooting sections
- [ ] Add links to official MCP documentation and community resources

### 4. Refactoring & Maintenance
- [ ] Regularly refactor code to follow code-style guidelines
- [ ] Remove dead or unmaintained code
- [ ] Ensure consistency in types, exports/imports, and naming
- [ ] Improve module structure and separation of concerns (adapters, prompts, handlers, ...)

### 5. Security & Updates
- [ ] Regularly update dependencies (`npm audit`, `npm update`)
- [ ] Review security best practices in Dockerfile, docker-compose, and API
- [ ] Add input validation and robust error handling

### 6. Support for New Features & Integrations
- [ ] Add support for new prompt types, tools, and workflows
- [ ] Ensure compatibility with new MCP SDK and client versions
- [ ] Add guides and examples for integration with mobile and desktop apps

---

## Tasks & Issues

Below are concrete actionable tasks and TODOs for contributors. If you want to help, pick an unchecked item or open a new issue!

- [ ] Implement advanced prompt validation (e.g. check for duplicate IDs, required fields, variable usage)
- [ ] Add integration tests for MDC (Cursor Rules) adapter
- [ ] Improve error messages and user feedback in API responses
- [ ] Add screenshots to user guides (EN, CZ) for all major clients (Claude Desktop, Cursor IDE, LM Studio, LibreChat)
- [ ] Automate Docker image publishing on release (CI/CD)
- [ ] Add example Tasker profiles and Android automation scripts to the documentation
- [ ] Expand API documentation in `docs/04-api-reference.md` (add more endpoint examples, error cases)
- [ ] Review and improve security for new endpoints and integrations
- [ ] Add more advanced prompt/workflow examples (multi-step, chaining, etc.)
- [ ] Add CLI usage examples and troubleshooting section to the user guide
- [ ] Add support for environment variable validation and helpful startup errors
- [ ] Add badges for supported MCP clients (LM Studio, LibreChat, etc.) to README

Feel free to suggest more tasks or open issues for anything you find!

--- 