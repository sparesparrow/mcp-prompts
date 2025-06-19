![MCP-Prompts Architecture Overview](images/architecture.png)

> **Quick Reference:** The following Mermaid diagram provides a text-based architecture overview. GitHub now renders Mermaid diagrams natively in Markdown for easy navigation and accessibility.

```mermaid
graph TD
  subgraph Clients
    A1[LM Studio]
    A2[LibreChat]
    A3[Tasker (Android)]
    A4[Cursor IDE]
    A5[Claude Desktop]
  end
  subgraph MCP-Prompts Server
    B1[Prompt Service]
    B2[HTTP/SSE API]
    B3[Adapter Factory]
  end
  subgraph Storage Adapters
    C1[File Adapter]
    C2[Postgres Adapter]
    C3[MDC (Cursor Rules) Adapter]
  end
  subgraph Integrations
    D1[Docker]
    D2[GitHub Actions]
    D3[Release Automation]
  end

  A1 --> B2
  A2 --> B2
  A3 --> B2
  A4 --> B2
  A5 --> B2
  B2 --> B1
  B1 --> B3
  B3 --> C1
  B3 --> C2
  B3 --> C3
  B2 --> D1
  D2 --> D3
  D1 --> B2
```

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

## Docker Images & Automated Publishing

Docker images for MCP-Prompts are automatically built and published to the GitHub Container Registry (GHCR) on every push to `main` and on every version tag (e.g., `v1.2.3`).

- **Registry:** `ghcr.io/sparesparrow/mcp-prompts`
- **Tags:** `latest`, or a specific version (e.g., `v1.2.43`)

### Pull the Latest Image
```bash
docker pull ghcr.io/sparesparrow/mcp-prompts:latest
```

### Pull a Specific Version
```bash
docker pull ghcr.io/sparesparrow/mcp-prompts:v1.2.43
```

These images are built and signed automatically by [GitHub Actions](.github/workflows/docker-publish.yml) on every release.

> **Note:** If you need Docker Hub support, open an issue or PR. The workflow can be extended to push to Docker Hub as well.

### Release Notes Automation

Release notes for every GitHub release are now **automatically generated and categorized** using [release.yml](.github/release.yml). Categories include Features, Bugfixes, Dependencies, and Other Changes. You can customize these categories by editing `.github/release.yml`.

For more details and advanced configuration, see the [GitHub Docs: Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes).

---

## Implemented vs Planned Features

| Feature | Status | Notes |
| --- | :---: | --- |
| File storage adapter | ✅ | stable |
| Memory storage adapter | ✅ | stable, for testing/dev |
| PostgreSQL adapter (+ embeddings) | ✅ | since v1.2.x |
| MDC adapter (Cursor Rules) | ✅ | stable, fully tested |
| HTTP server + SSE | ⚠️ | experimental |
| ElasticSearch adapter | 🛠️ | v1.3 roadmap |
| Orchestrator integration | 🛠️ | concept |
| Mermaid diagram server | 🛠️ | concept |

Legend: ✅ stable · ⚠️ experimental · 🛠️ in progress

---

## Documentation

This README is intentionally concise. Full documentation lives in the `docs/` directory, and each key directory (`scripts/`, `docker/scripts/`, `legacy/`, `examples/`) contains a README for navigation and usage details.

> **See also:** Links to official MCP documentation and community resources are provided below.

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

> **New:** See [examples/advanced-workflow-example.json](./examples/advanced-workflow-example.json) and the expanded [Templates Guide](./docs/05-templates-guide.md) for advanced prompt chaining and workflow usage.

> **Validation:** Prompts are now validated for required fields, duplicate IDs, variable consistency, and content format. See [src/prompt-service.ts](./src/prompt-service.ts) for details.
> **Testing:** The MDC (Cursor Rules) adapter is now covered by integration tests. See [tests/integration/mdc-adapter.integration.test.ts](./tests/integration/mdc-adapter.integration.test.ts).

---

## Official MCP Documentation & Community Resources

- [Model Context Protocol (MCP) – Official Docs](https://modelcontextprotocol.org/)
- [MCP GitHub Organization](https://github.com/modelcontextprotocol)
- [Cursor IDE – Model Context Protocol](https://docs.cursor.com/context/model-context-protocol)
- [MCP Community Discussions](https://github.com/orgs/community/discussions)
- [GitHub Actions Starter Workflows (for workflow inspiration)](https://github.com/actions/starter-workflows)

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

## Community Standards

We are committed to a welcoming, inclusive, and safe community for all contributors.

- Please read our [Contributing Guide](./CONTRIBUTING.md) before opening issues or pull requests.
- All contributors and participants are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).
- Security issues should be reported privately as described in our [Security Policy](./SECURITY.md).
- We use [issue templates](./.github/ISSUE_TEMPLATE/) and a [pull request template](./.github/pull_request_template.md) to help you provide actionable, high-quality contributions.

---

## License

Distributed under the MIT license. See `LICENSE` for more information.

## Project Board & Roadmap

We use a [GitHub Project board](https://github.com/sparesparrow/mcp-prompts/projects) to track issues, features, and roadmap items.
- See what's planned, in progress, and completed.
- Suggest new features or improvements by opening an issue or discussion.

**Contributors:** Please check the board for tasks marked "help wanted" or "good first issue"!

---

## Using the MDC (Cursor Rules) Adapter

To use the MDC adapter for storage:

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

## CLI Usage & Troubleshooting

You can run MCP-Prompts via npx, Docker, or as a Node.js package. For full CLI options, troubleshooting, and advanced usage, see the [User Guide](./USER_GUIDE.md).

Common commands:
```bash
npx -y @sparesparrow/mcp-prompts --help
npm run test:unit
npm run test:integration
```

If you encounter issues, see the FAQ & Troubleshooting section below or open an issue on GitHub.

---

## Roadmap & Quality Improvements

All major features and integrations are now implemented and tested. Remaining roadmap items are tracked as GitHub issues. Experimental features are marked as such in the table below.

| Feature | Status | Notes |
| --- | :---: | --- |
| File storage adapter | ✅ | stable |
| Memory storage adapter | ✅ | stable, for testing/dev |
| PostgreSQL adapter (+ embeddings) | ✅ | since v1.2.x |
| MDC adapter (Cursor Rules) | ✅ | stable, fully tested |
| HTTP server + SSE | ⚠️ | experimental |
| ElasticSearch adapter | 🛠️ | v1.3 roadmap |
| Orchestrator integration | 🛠️ | concept |
| Mermaid diagram server | 🛠️ | concept |

Legend: ✅ stable · ⚠️ experimental · 🛠️ in progress

---

## Tasks & Issues

The following are the main areas for future contributions:
- Add support for new prompt types, tools, and workflows
- Ensure compatibility with new MCP SDK and client versions
- Add guides and examples for integration with mobile and desktop apps
- Add more advanced prompt/workflow examples (multi-step, chaining, etc.)
- Add support for environment variable validation and helpful startup errors
- Review and improve security for new endpoints and integrations

> For the full list of open issues and feature requests, see the [GitHub Issues](https://github.com/sparesparrow/mcp-prompts/issues) page.

---

## FAQ & Troubleshooting

**Q: The server starts but I can't access it at http://localhost:3003/health.**
A: Make sure the server is running, the port is not blocked by a firewall, and you are using the correct address. If running in Docker, check port mappings and container status.

**Q: Prompts are not showing up in my client (e.g., Cursor IDE, Claude Desktop, LM Studio).**
A: Double-check the client configuration (server URL, port, and protocol). Ensure MCP-Prompts is running and accessible from the client machine. See the [User Guides](./USER_GUIDE.md) for step-by-step setup.

**Q: How do I add or update environment variables?**
A: You can set environment variables in your shell, `.env` file, or Docker Compose file. See [docs/02-configuration.md](./docs/02-configuration.md) for all supported variables and their defaults.

**Q: How do I chain prompts or create multi-step workflows?**
A: Use templates with variables and reference outputs between steps. See [examples/advanced-workflow-example.json](./examples/advanced-workflow-example.json) and the [Templates Guide](./docs/05-templates-guide.md) for details.

**Q: I get ESM/TypeScript errors when running tests.**
A: Use the provided npm scripts (e.g., `npm run test:unit`) and ensure all imports use explicit `.js` extensions. See the ESM/TypeScript/Jest notes in this README.

**Q: Where can I find more help or report issues?**
A: Check the [User Guides](./USER_GUIDE.md), [docs/](./docs/) directory, or open an issue on [GitHub](https://github.com/sparesparrow/mcp-prompts/issues).

**Q: What does an error response from the API look like?**
A: All HTTP API errors are returned in a standardized JSON format with clear error codes and messages. See [docs/04-api-reference.md](./docs/04-api-reference.md#error-handling-and-response-format) for details and examples.

--- 