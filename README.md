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
- [Integration with Other MCP Servers](#integration-with-other-mcp-servers)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

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
npm install
npm run build
npm start
```

### 4. Health Check

```bash
curl http://localhost:3003/health
```

---

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
