# MCP Prompts Server · `@sparesparrow/mcp-prompts`

[![CI](https://github.com/sparesparrow/mcp-prompts/actions/workflows/ci.yml/badge.svg)](../../actions)
[![npm](https://img.shields.io/npm/v/@sparesparrow/mcp-prompts)](https://www.npmjs.com/package/@sparesparrow/mcp-prompts)
[![Docker Pulls](https://img.shields.io/docker/pulls/sparesparrow/mcp-prompts)](https://hub.docker.com/r/sparesparrow/mcp-prompts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **MCP Prompts Server** is a robust, extensible server for managing, versioning, and serving prompts and templates for LLM applications, built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/specification/draft). It is the canonical TypeScript implementation and reference for prompt management in the MCP ecosystem.

---

## Table of Contents
- [Why MCP Prompts?](#why-mcp-prompts)
- [Features](#features)
- [Quick Start](#quick-start)
- [Scripts & CLI Reference](#scripts--cli-reference)
- [MCP Features & Architecture](#mcp-features--architecture)
- [MCP TypeScript SDK Role](#mcp-typescript-sdk-role)
- [Alternative Approaches](#alternative-approaches)
- [Community Packages](#community-packages)
- [End-to-End Usage: Official MCP TypeScript SDK, PostgreSQL, Inspector, and Proxy](#end-to-end-usage-official-mcp-typescript-sdk-postgresql-inspector-and-proxy)
- [Integration with Other MCP Servers](#integration-with-other-mcp-servers)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)
- [🛠️ Příklady konfigurace MCP klienta a serveru (`mcp.json`, `.env`)](#️-příklady-konfigurace-mcp-klienta-a-serveru-mcpjson-env)
- [Hexagonální architektura v MCP-Prompts](#hexagonální-architektura-v-mcp-prompts)
- [Architecture: Hexagonal (Ports & Adapters)](#architecture-hexagonal-ports--adapters)
- [MCP Prompts Monorepo Build Setup](#mcp-prompts-monorepo-build-setup)
- [TypeScript Monorepo Best Practices](#typescript-monorepo-best-practices)
- [Troubleshooting](#troubleshooting)
- [References](#references)

---

## Why MCP Prompts?

Prompt chaos is real: teams lose track of prompt versions, struggle to test changes, and risk leaking sensitive instructions. **MCP Prompts** solves this by providing:

- **Centralized, versioned prompt storage**
- **Robust API for CRUD, search, and template application**
- **Seamless integration with the broader MCP ecosystem**
- **Extensible adapters for file, memory, and database backends**
- **OpenAPI documentation and strong type safety**

---

## Features

- **Full MCP Prompt API**: Create, read, update, delete, list, and apply prompts via MCP tools and HTTP endpoints
- **Bulk Operations**: Batch import/export, bulk update, and catalog management
- **Versioning**: Track prompt history, revert, and audit changes
- **Template System**: Apply variables to prompts, validate required arguments
- **Multiple Storage Backends**: File, in-memory, PostgreSQL, and pluggable adapters
- **OpenAPI & Type Safety**: Auto-generated OpenAPI docs and strict TypeScript types
- **Rate Limiting & Security**: Built-in rate limiting, CORS, and API key support
- **Health Checks & Metrics**: `/health` endpoint, usage metrics, and audit logs
- **Docker & Compose Support**: Production-ready images and multi-service orchestration
- **MCP Ecosystem Integration**: Works with Filesystem, Memory, GitHub, and other MCP servers
- **Extensible**: Add new adapters, tools, or integrations with minimal code
- **ElevenLabs Integration**: Optional audio synthesis for prompt summaries
- **Atomic File Writes**: All prompt and index files are written atomically (temp file + rename) to prevent corruption.
- **File Locking**: Uses proper-lockfile to prevent concurrent write corruption.
- **Schema Validation**: All prompt files are validated with Zod on add/update and at startup.
- **Indexing**: Maintains an index.json for fast prompt listing and metadata lookup.
- **Robustness Tests**: Includes tests for atomicity, locking, and schema validation in the file adapter.

---

## Quick Start

### 1. Run with NPX (Recommended for Most Users)

```bash
npx -y @sparesparrow/mcp-prompts
```

### 2. Run with Docker

**File storage:**
```bash
docker run -d --name mcp-server -p 3003:3003 -v $(pwd)/data:/app/data ghcr.io/sparesparrow/mcp-prompts:latest
```

**Postgres storage:**
```bash
docker run -d --name mcp-server -p 3003:3003 -v $(pwd)/data:/app/data \
  -e "STORAGE_TYPE=postgres" -e "POSTGRES_URL=your_connection_string" \
  ghcr.io/sparesparrow/mcp-prompts:latest
```

**Docker Compose (multi-server):**
```bash
docker-compose -f docker-compose.yml -f docker-compose.extended.yml up -d
```

### 3. Build from Source

```bash
git clone https://github.com/sparesparrow/mcp-prompts.git
cd mcp-prompts
pnpm install
pnpm run build
pnpm start
```

### 4. Health Check

```bash
curl http://localhost:3003/health
```

---

## Build & Development

### Monorepo Build Commands

```bash
# Build all packages
pnpm run build

# Build with watch mode
pnpm run build:watch

# Type checking
pnpm run typecheck

# Clean all build artifacts
pnpm run clean

# Run tests
pnpm run test

# Lint and format
pnpm run lint
pnpm run format
```

### Individual Package Builds

```bash
# Build specific package
cd packages/core && pnpm run build

# Build all adapters
pnpm --filter "./packages/adapters-*" run build

# Build server app
cd apps/server && pnpm run build
```

## Scripts & CLI Reference

All scripts are in the `scripts/` directory. Key scripts include:

| Script                                 | Description                                                      |
|----------------------------------------|------------------------------------------------------------------|
| `test-npm-mcp-prompts.sh`              | Test MCP Prompts via npx and MCP Inspector                       |
| `test-docker-mcp-prompts.sh`           | Test official Docker image and MCP Inspector                     |
| `test-docker-compose-mcp-prompts.sh`   | Test Docker Compose environment with MCP Inspector               |
| `extract-catalog.sh`                   | Extract and validate prompt catalog                              |
| `extract-contracts.sh`                 | Extract and validate API contracts                               |
| `extract-implementations.sh`           | Extract implementation details for documentation                 |
| `setup-claude-desktop.sh`              | Setup integration with Claude Desktop                            |
| `build-and-push-docker.sh`             | Build and push Docker images                                     |
| `run-tests.sh`                         | Run all unit and integration tests                               |
| `release.sh`                           | Automated release and version bump script                        |
| `publish.sh`                           | Publish package to npm                                          |

**Usage:**
```bash
./scripts/<script-name> --help
```

---

## MCP Features & Architecture

MCP Prompts implements the full [Model Context Protocol](https://modelcontextprotocol.io/specification/draft) prompt API:

- **Prompts**: CRUD, list, search, and apply (with variable substitution)
- **Resources**: Expose prompt data as MCP resources
- **Tools**: Register prompt management tools (add, get, list, apply, delete)
- **Bulk Operations**: Import/export, batch update
- **Versioning**: Track and revert prompt changes
- **Adapters**: File, memory, PostgreSQL, and pluggable custom adapters
- **OpenAPI Docs**: `/api-docs` endpoint with live documentation
- **Health & Metrics**: `/health` endpoint, audit logs, and usage stats
- **Security**: API key, CORS, rate limiting, and RBAC (role-based access control)
- **Extensibility**: Add new tools, adapters, or integrations via plugin pattern
- **ElevenLabs Integration**: Optional audio synthesis for prompt summaries

**Architecture Overview:**
- **Core**: Prompt management, template engine, versioning
- **Adapters**: Storage (file, memory, Postgres), external MCP servers
- **API Layer**: MCP tools/resources, HTTP endpoints, OpenAPI docs
- **Integrations**: ElevenLabs, Filesystem/Memory/GitHub MCP servers

---

## MCP TypeScript SDK Role

MCP Prompts is built on the [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk), the canonical TypeScript implementation of the MCP specification. The SDK provides:

- **Protocol Compliance**: Handles JSON-RPC, connection lifecycle, and capability negotiation
- **Server/Client Abstractions**: Easy creation of MCP servers and clients
- **Transport Support**: stdio, Streamable HTTP, and SSE
- **Schema-Driven APIs**: Zod-based validation for all tool/resource definitions
- **Extensibility**: Register new tools, resources, and prompts with minimal code

By using the SDK, MCP Prompts ensures full compatibility with the evolving MCP standard and can be easily extended or integrated with other MCP-based tools.

---

## Alternative Approaches

Depending on your needs, you may consider:

- **Other Language Implementations**: Use [mcp-prompts-rs](https://github.com/sparesparrow/mcp-prompts-rs) (Rust) for high-performance or embedded use cases
- **Custom Adapters**: Implement your own storage or metadata adapters using the documented interfaces
- **Direct Integration**: Use the MCP TypeScript SDK to build your own server or client for specialized workflows
- **Community Servers**: Leverage other MCP servers (Filesystem, Memory, GitHub, etc.) for federated or distributed prompt management

---

## Community Packages

Recommended packages for advanced use:

- [`@sparesparrow/mcp-prompts-catalog`](https://www.npmjs.com/package/@sparesparrow/mcp-prompts-catalog): Curated prompt catalog for MCP
- [`@sparesparrow/mcp-prompts-contracts`](https://www.npmjs.com/package/@sparesparrow/mcp-prompts-contracts): Shared TypeScript types and OpenAPI contracts
- [`@modelcontextprotocol/server-postgres`](https://www.npmjs.com/package/@modelcontextprotocol/server-postgres): PostgreSQL storage adapter
- [`@modelcontextprotocol/server-filesystem`](https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem): Filesystem MCP server
- [`@modelcontextprotocol/server-memory`](https://www.npmjs.com/package/@modelcontextprotocol/server-memory): In-memory MCP server
- [`@modelcontextprotocol/server-github`](https://www.npmjs.com/package/@modelcontextprotocol/server-github): GitHub sync MCP server
- [`@modelcontextprotocol/inspector`](https://www.npmjs.com/package/@modelcontextprotocol/inspector): Debugging and inspection tool for MCP servers

---

## End-to-End Usage: Official MCP TypeScript SDK, PostgreSQL, Inspector, and Proxy

This section provides a complete workflow for building, running, debugging, and exposing a custom MCP server using the official TypeScript SDK, PostgreSQL, MCP Inspector, and mcp-proxy. All commands and examples work on Linux, macOS, and Windows (including WSL).

### 1. Install the Official TypeScript SDK and Dependencies

```bash
npm install @modelcontextprotocol/sdk zod pg
```
- `@modelcontextprotocol/sdk` – Official MCP SDK (server, types, transports)
- `zod` – Input and schema validation
- `pg` – PostgreSQL driver

---

### 2. Example MCP Server with PostgreSQL

```ts
// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Pool } from "pg";
import { z } from "zod";

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const server = new McpServer({
  name: "mcp-prompts-postgres",
  version: "1.0.0"
});

// Example tool: fetch a prompt from the database
server.registerTool(
  "getPromptFromDb",
  {
    title: "Get prompt from DB",
    description: "Returns a prompt template stored in Postgres",
    inputSchema: { id: z.string() }
  },
  async ({ id }) => {
    const { rows } = await db.query(
      "SELECT text FROM prompts WHERE id = $1",
      [id]
    );
    return {
      content: [{ type: "text", text: rows[0]?.text ?? "Not found" }]
    };
  }
);

// Start the server using stdio transport
await server.connect(new StdioServerTransport());
```

---

### 3. Local Environment with Docker Compose

```yaml
# docker-compose.yml
version: "3.9"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: mcp
      POSTGRES_USER: mcp
      POSTGRES_PASSWORD: mcp
    ports: ["5432:5432"]
    volumes: ["./pgdata:/var/lib/postgresql/data"]

  mcp-server:
    build: .
    command: node dist/server.js
    environment:
      DATABASE_URL: postgres://mcp:mcp@postgres:5432/mcp
    depends_on: [postgres]
```

---

### 4. Debugging with MCP Inspector

1. Build your server:
   ```bash
   npx tsc
   ```
2. Start the Inspector with your server binary:
   ```bash
   npx @modelcontextprotocol/inspector node dist/server.js
   ```
   The Inspector UI will open at http://localhost:6274 and allows you to:
   - Switch transport (stdio / http)
   - Browse Resources/Prompts/Tools
   - Send test requests and view logs

---

### 5. Exposing the Server Remotely with mcp-proxy

If you need to connect a client expecting SSE or Streamable HTTP to your stdio-based server, use mcp-proxy as a bridge:

```bash
# stdio → SSE bridge on port 8080
npx -y @modelcontextprotocol/proxy --stdio "node dist/server.js" --sse 8080
```

This will expose your MCP server over SSE/HTTP for remote access.

---

## Integration with Other MCP Servers

MCP Prompts can be used standalone or as part of a federated MCP ecosystem. Integration patterns include:

### 1. **Client-Side Federation**
Configure multiple MCP servers in your host application (e.g., Claude Desktop, Cursor):

```json
{
  "mcpServers": {
    "mcp-prompts": { "command": "npx", "args": ["-y", "@sparesparrow/mcp-prompts"] },
    "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"] },
    "memory": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] },
    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }
  }
}
```

### 2. **Server-Side Integration**
MCP Prompts can connect to other MCP servers (Filesystem, Memory, GitHub) as storage or metadata backends via adapters. Use Docker Compose for orchestration:

```yaml
version: '3.8'
services:
  mcp-prompts:
    image: ghcr.io/sparesparrow/mcp-prompts:latest
    environment:
      - STORAGE_TYPE=file
      - PROMPTS_DIR=/app/prompts
    volumes:
      - ./prompts:/app/prompts
    depends_on:
      - filesystem-server
      - memory-server
      - github-server
  filesystem-server:
    image: ghcr.io/modelcontextprotocol/server-filesystem:latest
    volumes:
      - ./prompts:/prompts
  memory-server:
    image: ghcr.io/modelcontextprotocol/server-memory:latest
    volumes:
      - ./data:/data
  github-server:
    image: ghcr.io/modelcontextprotocol/server-github:latest
    environment:
      - GITHUB_PERSONAL_ACCESS_TOKEN=${GITHUB_TOKEN}
```

### 3. **Routing and Federation**
MCP Prompts does not natively proxy or federate requests to other servers, but you can use API gateways, custom adapters, or orchestration tools to build federated workflows. See the [MCP Integration Guide](docs/06-mcp-integration.md) for advanced patterns.

---

## Contributing

We welcome contributions of all kinds! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, code style, and the PR process.

---

## License

MIT License. See [LICENSE](LICENSE).

---

## Support

- **Bugs & Issues:** [GitHub Issues](../../issues)
- **Discussions:** [GitHub Discussions](../../discussions)
- **Commercial Support:** [Sparrow AI & Tech](mailto:support@sparrowai.tech)

---

<sub>Built with ❤️ by [@sparesparrow](https://github.com/sparesparrow) and the [community](https://github.com/sparesparrow/mcp-prompts/graphs/contributors)</sub>

---

## 🛠️ Příklady konfigurace MCP klienta a serveru (`mcp.json`, `.env`)

MCP klienti (např. Cursor, Claude Desktop, VS Code, Amazon Q) podporují různé formáty konfiguračních souborů a způsoby spouštění MCP serveru. Níže najdete vzorové konfigurace pro všechny běžné scénáře.

### 1. Formáty `mcp.json`

#### a) Formát `mcpServers` (Cursor, Claude Desktop, Amazon Q)
```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"],
      "env": {
        "PROMPTS_DIR": "./my-prompts",
        "STORAGE_TYPE": "postgres"
      },
      "timeout": 30000
    }
  }
}
```

#### b) Formát `servers` (VS Code, Hugging Face clients)
```json
{
  "servers": [
    {
      "name": "mcp-prompts",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@sparesparrow/mcp-prompts"]
      },
      "env": {
        "PROMPTS_DIR": "./my-prompts"
      }
    }
  ]
}
```

### 2. Konfigurace pro různá prostředí

#### **Linux Host**
```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "/usr/bin/node",
      "args": ["/opt/mcp-prompts/dist/server.js"],
      "env": {
        "PROMPTS_DIR": "/home/user/prompts",
        "STORAGE_TYPE": "file",
        "NODE_ENV": "production"
      }
    }
  }
}
```

Alternativně s wrapper scriptem:
```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "./scripts/start-mcp-prompts.sh"
    }
  }
}
```

#### **Windows Host**
```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\mcp-prompts\\dist\\server.js"],
      "env": {
        "PROMPTS_DIR": "C:\\Users\\%USERNAME%\\Documents\\prompts",
        "STORAGE_TYPE": "file"
      }
    }
  }
}
```

#### **Docker Image**
```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "${PWD}/prompts:/app/prompts",
        "-e", "PROMPTS_DIR=/app/prompts",
        "-e", "POSTGRES_URL",
        "sparesparrow/mcp-prompts:latest"
      ],
      "env": {
        "POSTGRES_URL": "${POSTGRES_URL}"
      }
    }
  }
}
```

#### **NPM Package (doporučený způsob)**
```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": [
        "-y", 
        "@sparesparrow/mcp-prompts",
        "--source", "catalog:",
        "--source", "file:./company-prompts"
      ],
      "env": {
        "STORAGE_TYPE": "postgres",
        "POSTGRES_URL": "${POSTGRES_URL}",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### 3. Bezpečné proměnné prostředí (`.env` a VS Code style)

Doporučujeme používat `.env` soubor nebo bezpečné prompty pro citlivé údaje:

```env
POSTGRES_URL=postgres://user:password@localhost:5432/mcp_prompts
PROMPTS_DIR=./prompts
LOG_LEVEL=info
```

Nebo v konfiguraci VS Code:
```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "postgres-url",
      "description": "PostgreSQL Connection URL",
      "password": true
    },
    {
      "type": "promptString", 
      "id": "prompts-dir",
      "description": "Cesta k promptům"
    }
  ]
}
```

## Hexagonální architektura v MCP-Prompts

Projekt `mcp-prompts` je navržen podle principů hexagonální architektury (architektura portů a adaptérů), která zajišťuje čisté oddělení doménové logiky od vnějších závislostí (např. úložiště, templating, transportní vrstvy). Tento přístup přináší:

- **Lepší testovatelnost**: Doménová logika je izolovaná a snadno testovatelná bez závislosti na konkrétních implementacích adaptérů.
- **Snadná rozšiřitelnost**: Nové typy úložišť, šablonovacích systémů nebo transportních vrstev lze přidávat bez zásahu do jádra aplikace.
- **Udržovatelnost**: Jasné rozhraní mezi doménou a infrastrukturou usnadňuje refaktoring a vývoj.

### Struktura projektu podle hexagonální architektury

- `core/domain/` – Doménové entity a business logika (např. `prompt.entity.ts`)
- `core/ports/` – Rozhraní (porty) pro interakci s doménou (např. `prompt.repository.ts`, `templating.port.ts`, `api.port.ts`)
- `core/services/` – Doménové služby (např. `prompt.service.ts`)
- `adapters/` – Implementace portů (adaptéry), např. `file-storage.adapter.ts`, `eta-templating.adapter.ts`
- `transports/` – Transportní vrstvy (např. HTTP, MCP, SSE)
- `index.ts` – Kompozice aplikace, propojení portů a adaptérů

### Praktické příklady
- Pro přidání nového úložiště stačí implementovat rozhraní `PromptRepository` a zaregistrovat adaptér.
- Pro změnu templating systému stačí implementovat `TemplatingPort`.

### Odkazy
- [Oficiální MCP architektura](https://modelcontextprotocol.io/specification/2025-06-18/architecture)
- [Hexagonal Architecture (Alistair Cockburn)](https://alistair.cockburn.us/hexagonal-architecture/)

## Architecture: Hexagonal (Ports & Adapters)

mcp-prompts is architected using the Hexagonal Architecture (Ports & Adapters) pattern. This design separates the core business logic from external systems (storage, APIs, UI) via well-defined interfaces (ports) and their implementations (adapters).

**Key Components:**
- **Core (Hexagon):** Pure business logic for prompt management, versioning, templating, and validation. No dependencies on frameworks or infrastructure.
- **Ports (Interfaces):**
  - **Primary Port:** `IPromptApplication` – defines the API for all use cases (add, get, list, apply, etc.).
  - **Secondary Ports:**
    - `IPromptRepository` – contract for data persistence (file, Postgres, etc.).
    - `ITemplatingEngine` – contract for rendering templates.
- **Adapters (Implementations):**
  - **Primary/Driving:**
    - `MCPAdapter` (MCP JSON-RPC stdio/SSE)
    - `RestApiAdapter` (Express/HTTP, optional/future)
  - **Secondary/Driven:**
    - `FileStorageAdapter` (JSON files)
    - `PostgresStorageAdapter` (PostgreSQL)
    - `EtaTemplatingAdapter` (template rendering)

**Benefits:**
- Isolated, testable core logic
- Easy to add new storage or API adapters
- Stable, maintainable, and extensible foundation for the MCP ecosystem

**Directory Structure Example:**
```
mcp-prompts/
  core/
    entities/
    services/
    ports/
  adapters/
    primary/
      mcp/
      rest/
    secondary/
      file/
      postgres/
      eta/
  tests/
    core/
    adapters/
```

**Testing:**
- Core logic is tested with in-memory/mock ports (no I/O required).
- Adapters are tested with real dependencies (integration tests).

**Integration:**
- MCPAdapter uses `@modelcontextprotocol/sdk` to register tools/resources.
- Compatible with MCP Inspector, mcp-cli, Claude Desktop, and other MCP clients.

**References:**
- [Hexagonal Architecture: Wikipedia](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software))
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18/architecture)
- [DEV: Stop Losing Prompts – Build Your Own MCP Prompt Registry](https://dev.to/stevengonsalvez/stop-losing-prompts-build-your-own-mcp-prompt-registry-4fi1)

## MCP Prompts Monorepo Build Setup

## TypeScript Monorepo Best Practices

- Each package has its own `tsconfig.json` extending a shared `tsconfig.options.json`.
- The shared config enables ESM (`module: NodeNext`), strict type checking, and emits both `.js` and `.d.ts` files for all source files.
- `emitDeclarationOnly` is **not** used, so both JavaScript and type declarations are available for downstream packages.
- **Build order matters:**
  1. Build `@mcp-prompts/core` first (it emits all types and JS for downstream packages).
  2. Then build `@mcp-prompts/adapters-file` and `@mcp-prompts/adapters-memory`.
  3. Then run `pnpm -r build` for the full monorepo.
- The script `src/scripts/validate-prompts.ts` is excluded from the core build to avoid circular dependencies (it depends on adapters-file, which depends on core). If you need to build or run this script, do so separately after the main build.
- All imports between packages use the built outputs (e.g., `@mcp-prompts/core/dist/interfaces.js`).

## Troubleshooting

### Build Issues

**TypeScript Path Resolution Errors:**
```bash
# Clear TypeScript cache
rm -rf **/*.tsbuildinfo
pnpm run clean
pnpm run build
```

**SWC Build Failures:**
```bash
# Ensure SWC is installed
pnpm add -D @swc/cli @swc/core

# Clean and rebuild
pnpm run clean
pnpm run build
```

**Workspace Dependency Issues:**
```bash
# Reinstall workspace dependencies
pnpm install --force
pnpm run build
```

**Missing Modules or Types:**
- Ensure you have built `@mcp-prompts/core` first
- Check that all `dist/` directories are up to date
- If you change the shared config or move files, clean all `dist/` directories and rebuild

### Runtime Issues

**Common Issues:**
- If you see errors about missing modules or types, ensure you have built `@mcp-prompts/core` first and that all `dist/` directories are up to date.
- If you change the shared config or move files, clean all `dist/` directories and rebuild.

## References
- [Turborepo TypeScript Monorepo Guide](https://turborepo.com/docs/guides/tools/typescript)
- [Separate tsconfig for builds](https://www.timsanteford.com/posts/streamlining-your-next-js-builds-with-a-separate-typescript-configuration/)
