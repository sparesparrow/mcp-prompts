# mcp-prompts

[![MCP Toplist](https://mcptoplist.com/badge/glama%2Fsparesparrow%2Fmcp-prompts.svg)](https://mcptoplist.com/server/glama%2Fsparesparrow%2Fmcp-prompts)

Simple MCP server for managing AI prompts and agent configurations with direct claude CLI orchestration.

## What It Does

- **Stores prompts** as JSON files in `data/prompts/`
- **Exposes MCP tools** for querying and managing prompts
- **Provides agent templates** for project orchestration
- **Works with Claude Desktop, Cursor, and other MCP clients**

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

### 3. Configure Claude Desktop

Add to `~/.claude/mcp.json`:

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
| `list_prompts` | Query prompts with filters (tags, search, category) |
| `get_prompt` | Retrieve specific prompt with template expansion |
| `create_prompt` | Add new prompt to repository |
| `update_prompt` | Modify existing prompt |
| `delete_prompt` | Remove prompt |
| `apply_template` | Apply variables to template string |
| `get_stats` | Repository statistics |

## Prompts Organization

```
data/prompts/
├── main-agents/           # 7 project orchestration templates
│   ├── main_agent_python_backend.json
│   ├── main_agent_cpp_backend.json
│   ├── main_agent_android_app.json
│   ├── main_agent_embedded_iot.json
│   ├── main_agent_multiplatform_iot.json
│   └── ...
│
├── subagents/            # 19 specialized analysis agents
│   ├── explorer.json     # Project discovery
│   ├── analyzer.json     # Code analysis
│   ├── diagrammer.json   # Diagram generation
│   ├── solid_analyzer.json # Code quality
│   └── ...
│
├── cognitive/            # 7-layer cognitive architecture
├── esp32/                # Embedded systems patterns
├── mcp-tools/           # MCP usage patterns
└── [domains]/           # Domain-specific knowledge
```

## Architecture

Simple and focused:

```
┌──────────────────────────────┐
│   MCP Server (stdio)         │
│   ├── list_prompts           │
│   ├── get_prompt             │
│   ├── create_prompt          │
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
