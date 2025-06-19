# MCP Prompts Server

[![Build Status](https://img.shields.io/github/actions/workflow/status/sparesparrow/mcp-prompts/ci.yml?branch=main)](https://github.com/sparesparrow/mcp-prompts/actions)
[![Coverage](https://codecov.io/gh/sparesparrow/mcp-prompts/branch/main/graph/badge.svg)](https://codecov.io/gh/sparesparrow/mcp-prompts)
[![npm](https://img.shields.io/npm/v/@sparesparrow/mcp-prompts)](https://www.npmjs.com/package/@sparesparrow/mcp-prompts)
[![License](https://img.shields.io/github/license/sparesparrow/mcp-prompts.svg)](LICENSE)
![LM Studio](https://img.shields.io/badge/Client-LM%20Studio-blue?logo=appveyor)
![LibreChat](https://img.shields.io/badge/Client-LibreChat-blue?logo=appveyor)
![Tasker](https://img.shields.io/badge/Client-Tasker-blue?logo=appveyor)
![Android](https://img.shields.io/badge/Client-Android-green?logo=android)
![Cursor IDE](https://img.shields.io/badge/Client-Cursor%20IDE-blue?logo=visualstudiocode)
![Claude Desktop](https://img.shields.io/badge/Client-Claude%20Desktop-blue?logo=anthropic)

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

- [How to use MCP-Prompts with Claude Desktop, Cursor IDE, LM Studio, LibreChat, and Tasker (English)](./USER_GUIDE.md)
- [Jak používat MCP-Prompts s Claude Desktop, Cursor IDE, LM Studio, LibreChat a Taskerem (česky)](./USER_GUIDE-cs.md)

> **Note:** User guides are now fully expanded for all major clients, including step-by-step setup, troubleshooting, and quick reference checklists. See the guides above for details.

---

## Supported Clients

MCP-Prompts works with the following clients:

- **LM Studio** – [Setup Guide](#)
- **LibreChat** – [Setup Guide](#)
- **Tasker (Android)** – [Setup Guide](#)
- **Cursor IDE** – [Setup Guide](#)
- **Claude Desktop** – [Setup Guide](#)

See the [examples/](./examples/) directory for configuration snippets.

---

## How to Contribute

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines, or open an issue if you have questions or suggestions.

- Fork the repo and create a feature branch
- Run `npm install` and `npm test` to ensure all tests pass
- Submit a pull request with a clear description

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
- [x] Stabilize and document the MDC (Cursor Rules) adapter
- [x] Expand support for new MCP clients (LM Studio, LibreChat, Tasker, Android, etc.)
- [x] Add and extend user guides (EN, CZ) for all supported clients and integrations
- [ ] Add advanced workflow and prompt usage examples

### 2. Testing & CI/CD
- [x] Ensure high test coverage (unit, integration, E2E)
- [x] Regularly run CI pipeline (lint, tests, build, validation, audit)
- [x] Add tests for MDC adapter and new storage backends
- [x] Automate CLI and API tests
- [x] ESM/TypeScript/Jest compatibility: All tests and coverage run with Node ESM modules using --experimental-vm-modules. See package.json scripts for details.

### 3. Documentation & Clarity
- [ ] Keep README and user guides concise and up to date
- [ ] Add/update README files in all key directories (`scripts/`, `legacy/`, `examples/`, `docker/scripts/`)
- [ ] Add detailed examples, FAQ, and troubleshooting sections
- [ ] Add links to official MCP documentation and community resources

### 4. Refactoring & Maintenance
- [x] Regularly refactor code to follow code-style guidelines
- [x] Remove dead or unmaintained code
- [x] Ensure consistency in types, exports/imports, and naming
- [x] Improve module structure and separation of concerns (adapters, prompts, handlers, ...)

### 5. Security & Updates
- [x] Regularly update dependencies (`npm audit`, `npm update`)
- [x] Review security best practices in Dockerfile, docker-compose, and API
- [x] Add input validation and robust error handling

### 6. Support for New Features & Integrations
- [ ] Add support for new prompt types, tools, and workflows
- [ ] Ensure compatibility with new MCP SDK and client versions
- [ ] Add guides and examples for integration with mobile and desktop apps

---

## ESM, TypeScript, and Jest Setup (Developer Note)

- The project uses ESM modules (`"type": "module"` in package.json) and TypeScript with Node.js.
- Jest is configured to run with ESM support using the `--experimental-vm-modules` flag. See the `test:unit` and `test:coverage` scripts in package.json.
- If you encounter `Cannot use import statement outside a module` or similar ESM errors, ensure you:
  - Use explicit `.js` extensions in all relative imports in TypeScript files.
  - Run tests with the provided scripts (not plain `jest`).
  - See [Jest ESM Docs](https://jestjs.io/docs/ecmascript-modules) and [Node/TS/ESM troubleshooting](https://thedrlambda.medium.com/nodejs-typescript-and-the-infuriating-esm-errors-828b77e7ecd3).

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