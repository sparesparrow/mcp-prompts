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

- **GitHub Packages (preferred):** [`@sparesparrow/mcp-prompts`](https://github.com/sparesparrow/mcp-prompts/pkgs/npm/mcp-prompts), registry `https://npm.pkg.github.com`
- npm: [`@sparesparrow/mcp-prompts`](https://www.npmjs.com/package/@sparesparrow/mcp-prompts), no token needed

Both registries receive the same version from every `v*` tag (first together at 4.0.2); Docker images follow the same tag.
- Docker: `ghcr.io/sparesparrow/mcp-prompts` (Docker Hub: [`sparesparrow/mcp-prompts`](https://hub.docker.com/r/sparesparrow/mcp-prompts))

## Quick Start

### 1. Install from GitHub Packages

GitHub Packages asks for a token even for public packages (without one the install fails with `401 Unauthorized`). Create a personal access token with the `read:packages` scope (or, with the GitHub CLI, run `gh auth refresh -h github.com -s read:packages`), then add this to `~/.npmrc`:

```ini
@sparesparrow:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

Keep the token out of any file you commit. Then install:

```bash
npm install -g @sparesparrow/mcp-prompts
mcp-prompts   # starts the MCP server on stdio; stop it with Ctrl+C
```

The package ships the prompts in `data/prompts`, and the server finds them wherever an MCP client starts it from. Set `PROMPTS_DIR` to use your own directory instead.

To install from npm instead, skip the `~/.npmrc` lines above and run `npm install -g @sparesparrow/mcp-prompts`. It is the same package, and npm needs no token.

### 2. Add the server to your MCP client

**Claude Code**, for every project:

```bash
claude mcp add -s user mcp-prompts -- mcp-prompts
```

Or for one project, commit a `.mcp.json` at its root (no paths or tokens in it). Claude Code asks you to approve it the first time:

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "mcp-prompts",
      "args": []
    }
  }
}
```

Check it with `claude mcp list`. Use one of the two: registering the same name at both scopes gives you two servers.

**Claude Desktop** and other clients take the same command in their config (for Claude Desktop, `claude_desktop_config.json`), with the same `mcpServers` block as above. If the client does not find `mcp-prompts` on its PATH, use the full path from `which mcp-prompts` as the `command`.

### Choose what gets installed

By default an install serves every bundled prompt through the seven tools. You can instead choose:

- which **plain prompts** and which **templates** to serve (two separate lists);
- which **MCP capabilities** expose them: `tools`, `prompts` (each prompt becomes a slash command, with a template's variables as its arguments) and `resources` (each prompt is readable as `prompts://<id>`, for attaching as context);
- whether the install is **read-only** (no `add_prompt`, `update_prompt` or `delete_prompt`).

The same options go in the install command, the client config file, a dedicated config file or the URL:

| Option | Flag | Environment | Config file | URL (`/mcp?…`) |
|---|---|---|---|---|
| Plain prompts to serve | `--prompts` | `MCP_PROMPTS_PROMPTS` | `prompts` | `prompts` |
| Templates to serve | `--templates` | `MCP_PROMPTS_TEMPLATES` | `templates` | `templates` |
| Leave out of both | `--exclude` | `MCP_PROMPTS_EXCLUDE` | `exclude` | `exclude` |
| Capabilities (default `tools`) | `--expose` | `MCP_PROMPTS_EXPOSE` | `expose` | `expose` |
| Read-only | `--read-only` | `MCP_PROMPTS_READ_ONLY` | `readOnly` | `readOnly` |
| Library instead of the bundled one | `--prompts-dir` | `PROMPTS_DIR` | `promptsDir` | – |
| Your own directories, served in full | `--dir` (repeat) | `MCP_PROMPTS_DIRS` | `dirs` | – |
| Config file | `--config` | `MCP_PROMPTS_CONFIG` | – | – |

A list is comma-separated, and its entries can be:

- `all` (the default for each list) or `none`;
- a **group**, meaning a directory of the library such as `mia-car` (`cognitive` also covers `cognitive/meta`);
- a prompt **id**;
- `tag:<tag>`.

Flags override environment variables, which override the config file. Paths in a config file are relative to that file. Only the library is filtered: prompts in your own `--dir` directories, and prompts added while the server runs, are always served. An own prompt with a library prompt's id replaces it.

See what there is to choose, and what a choice serves:

```bash
mcp-prompts catalog                                   # groups, with plain/template counts, tags and ids
mcp-prompts catalog --prompts none --templates mia-car --json
```

Then install it in any of these forms. `mcp-prompts config` with the same options prints all four, ready to paste:

```bash
# Command
claude mcp add -s user mcp-prompts -- mcp-prompts --prompts none --templates mia-car,openclaw --expose tools,prompts --read-only
```

The same in a client config (`.mcp.json`, `claude_desktop_config.json`, Cursor and others):

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "mcp-prompts",
      "args": ["--prompts", "none", "--templates", "mia-car,openclaw", "--expose", "tools,prompts", "--read-only"]
    }
  }
}
```

```bash
# Dedicated config file (see examples/mcp-prompts.config.json), referenced from any client
mcp-prompts --config /absolute/path/to/mcp-prompts.json

# Docker: use the environment, since arguments after the image name replace its command
docker run --rm -i -e MCP_PROMPTS_TEMPLATES=mia-car -e MCP_PROMPTS_PROMPTS=none -e MCP_PROMPTS_EXPOSE=tools,prompts ghcr.io/sparesparrow/mcp-prompts

# URL, against a server started with mcp-prompts-http (see HTTP Mode)
claude mcp add -s user --transport http mcp-prompts "http://localhost:3003/mcp?prompts=none&templates=mia-car,openclaw&expose=tools,prompts&readOnly=true"
```

A URL chooses from what that server serves. It can narrow the server's selection and turn read-only on, but it cannot widen the selection, turn read-only off, or name directories. Mistyped options stop the server with exit code 2, and a URL with them gets HTTP 400. An entry that matches nothing, or matches only the other list (`--prompts mia-car` when mia-car holds only templates), is logged as a warning.

### Build from source

To run unreleased changes:

```bash
pnpm install
pnpm build
node dist/mcp-server-standalone.js    # or: pnpm start
```

and point your client at that file:

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-prompts/dist/mcp-server-standalone.js"],
      "env": { "PROMPTS_DIR": "/absolute/path/to/mcp-prompts/data/prompts" }
    }
  }
}
```

### 3. Use in Claude

Ask Claude:
- "List all prompts tagged with orchestration"
- "Get the claudepy-esp32-android-bridge-workflow prompt"
- "Apply the claudepy-esp32-android-bridge-workflow template with esp32_firmware_path set to ./firmware"
- "Add a prompt for Python FastAPI best practices"

Prompts added or changed through `add_prompt` / `update_prompt` live in memory and are lost when the server restarts. A prompt that must last is a JSON file under `data/prompts/` with a stable id, added by pull request.

## HTTP Mode

The same prompts are also available as a JSON API, for clients that don't speak MCP:

```bash
pnpm build
PORT=3003 PROMPTS_DIR=$PWD/data/prompts pnpm start:http
# or: npx mcp-prompts-http, or the default Docker image (port 3003)
```

| Method and path | Does |
|---|---|
| `GET /health`, `/ready`, `/version` | Liveness, readiness, package version |
| `GET /v1/prompts?tags=a,b&search=text` | List prompt summaries |
| `POST /v1/prompts` | Add a prompt (same fields as `add_prompt`) |
| `GET` / `PUT` / `DELETE /v1/prompts/:id` | Read, update or delete one prompt |
| `POST /v1/prompts/:id/apply` | Fill a template: `{ "variables": { ... } }` → `{ "result": "..." }` |
| `GET /v1/stats` | Same counts as `get_stats` |
| `GET /mcp/tools`, `POST /mcp/tools/:name` | Call any MCP tool by name: `{ "arguments": { ... } }` |
| `POST /mcp?…` | MCP itself (Streamable HTTP, stateless), for `claude mcp add --transport http`; the query string chooses prompts, templates and capabilities (see [Choose what gets installed](#choose-what-gets-installed)) |

```bash
curl -s -X POST localhost:3003/v1/prompts/claudepy-esp32-android-bridge-workflow/apply \
  -H 'Content-Type: application/json' -d '{"variables":{"esp32_firmware_path":"./firmware"}}'
```

`mcp-prompts-http` takes the same options as `mcp-prompts` (flags, environment, `--config`); they set what the whole server serves. With `--read-only`, the write routes and tools are left out.
Invalid input answers 400, unknown prompts 404. Set `CORS_ORIGIN` to allow browser clients.
Changes made over HTTP live in memory, like those made over MCP; the files in `data/prompts` are not rewritten.

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
