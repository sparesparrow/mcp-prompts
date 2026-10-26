# mcp-prompts

A [Model Context Protocol](https://modelcontextprotocol.io/) server that stores, searches and serves
prompt templates and agent configurations to any MCP client (Claude Desktop, Claude Code, Cursor and
others), plus a script that uses those templates to orchestrate Claude CLI agents over a whole project.

Listed on [Glama](https://glama.ai/mcp/servers/sparesparrow/mcp-prompts),
[MCP Market](https://mcpmarket.com/server/prompts-server) and
[AIBASE](https://mcp.aibase.com/server/1916334459480600578). A Rust reimplementation focused on memory
efficiency and concurrency lives in [mcp-prompts-rs](https://github.com/sparesparrow/mcp-prompts-rs).

## What It Does

- **Stores prompts** as JSON files in `data/prompts/`
- **Exposes MCP tools** for querying and managing prompts
- **Provides agent templates** for project orchestration
- **Works with Claude Desktop, Cursor, and other MCP clients**

## Packages

- npm: [`@sparesparrow/mcp-prompts`](https://www.npmjs.com/package/@sparesparrow/mcp-prompts)
- Docker Hub: [`sparesparrow/mcp-prompts`](https://hub.docker.com/r/sparesparrow/mcp-prompts)

Published releases lag behind `main`. To run what this README describes, build from source as below.

## Quick Start

### 1. Install

```bash
pnpm install
pnpm build
```

### 2. Start MCP Server

```bash
pnpm start
```

### 3. Configure your MCP client

For Claude Desktop, add to `claude_desktop_config.json` (other clients take the same command and env):

```json
{
  "mcpServers": {
    "prompts": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-prompts/dist/mcp-server-standalone.js"],
      "env": {
        "PROMPTS_DIR": "/absolute/path/to/mcp-prompts/data/prompts"
      }
    }
  }
}
```

### 4. Use in Claude

Ask Claude:
- "List all prompts tagged with esp32"
- "Get the esp32-fft-configuration-guide prompt"
- "Create a new prompt for Python FastAPI best practices"

## Orchestrating Projects

Use the orchestrate script to analyze entire projects:

```bash
./scripts/orchestrate-project.sh ~/projects/mia analyze
./scripts/orchestrate-project.sh ~/projects/esp32-bpm-detector review
```

This automatically:
1. Detects project type
2. Loads appropriate main agent
3. Spawns specialized subagents
4. Runs comprehensive analysis
5. Returns structured results

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_prompts` | List prompts, filtered by tags or a search term |
| `get_prompt` | Retrieve a prompt by ID |
| `add_prompt` | Add a new prompt or template |
| `update_prompt` | Modify existing prompt |
| `delete_prompt` | Remove prompt |
| `apply_template` | Fill a template prompt's `{{variables}}` |
| `get_stats` | Repository statistics |

## Prompts Organization

```
data/prompts/
├── main-agents/          # 9 project orchestration templates
│   ├── main_agent_python_backend.json
│   ├── main_agent_cpp_backend.json
│   ├── main_agent_android_app.json
│   ├── main_agent_embedded_iot.json
│   ├── main_agent_web_frontend.json
│   └── ...                # also web backend, DevOps, multiplatform IoT, generic
│
├── subagents/            # architecture, security and test analysts
├── cognitive/            # 7 layers: perception, episodes, semantic, procedures,
│                         #   evaluation, meta, transfer
├── embedded/, cross-platform/, home-automation/, mia-car/, voice-intelligence/
│                         # domain knowledge
├── claudepy-workflows/, openclaw/
│                         # agent workflow and routing prompts
└── learned/              # prompts produced by the learning loop
```

## Architecture

Two layers. The full server (`src/mcp/mcp-server.ts`) is hexagonal: the domain in `src/core` (entities,
events, services and the repository and event-bus ports) knows nothing about storage or transport, and
storage adapters plug in behind the ports — file and in-memory in `src/adapters`; the earlier DynamoDB,
S3 and SQS adapters, Lambda handlers and CDK stack are kept in `archive/aws` and `cdk/`. The standalone
server that `pnpm start` and the npm binary run is the small one below: it reads the JSON files in
`PROMPTS_DIR` directly and speaks MCP over stdio.

```
┌──────────────────────────────┐
│   MCP Server (stdio)         │
│   ├── list_prompts           │
│   ├── get_prompt             │
│   ├── add_prompt             │
│   └── ...                    │
├──────────────────────────────┤
│   File Storage               │
│   └── data/prompts/*.json    │
└──────────────────────────────┘

Orchestration:
  orchestrate-project.sh
    ↓ loads prompts
    ↓ builds agent config
    ↓ calls claude CLI
  Actual agent execution
```

## Development

```bash
pnpm install       # Install dependencies
pnpm build         # Build TypeScript
pnpm dev           # Watch mode
pnpm test          # Run tests
pnpm orchestrate   # Test orchestration
```

## Enterprise Deployment

For enterprise features (AWS, multi-tenant, payments), see [archive/aws/README.md](archive/aws/README.md).

Most users don't need this - the local MCP server is sufficient.

## License

MIT
