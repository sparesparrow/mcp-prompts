# mcp-prompts

A [Model Context Protocol](https://modelcontextprotocol.io/) server that stores, searches and serves
prompt templates and agent configurations to any MCP client (Claude Desktop, Claude Code, Cursor and
others), plus a script that uses those templates to orchestrate Claude CLI agents over a whole project.

Listed on [Glama](https://glama.ai/mcp/servers/sparesparrow/mcp-prompts),
[MCP Market](https://mcpmarket.com/server/prompts-server) and
[AIBASE](https://mcp.aibase.com/server/1916334459480600578). A Rust reimplementation focused on memory
efficiency and concurrency lives in [mcp-prompts-rs](https://github.com/sparesparrow/mcp-prompts-rs).

**[Configure an install in the browser](https://sparesparrow.github.io/mcp-prompts/):** pick a profile
or your own prompts and templates, choose the MCP capabilities, and copy the matching `claude mcp add`
command, client config, URL or config file. The page reads the library from this branch.

## What's new in 4.3.0

- **Android automation, the flagship use case.** Two new profiles: `android-automation` (app agents,
  Termux and the PRoot bridge, the router, and end-to-end scenarios such as Deep Research into a
  notebook with an audio overview, or a multi-AI PR review) and `tasker-automation` (project
  architecture, profiles, tasks, variables and secrets, config audits, safe direct edits, scene
  XML). Use them together with `--profile android-automation,tasker-automation`, and add
  `voice-home` for home commands. See [docs/10-android-automation.md](docs/10-android-automation.md).
  The phone-side code they are written for (MCP server, app agents, Tasker tools) is in the
  [android-assistant](https://github.com/sparesparrow/android-assistant) repository, split out of
  cliphist-android's `assistant/` with its history.
- **New prompt groups** `data/prompts/android-automation/` and `data/prompts/tasker/`.
- **Research write-up**
  [docs/research/2026-11-ai-ecosystem-consolidation.md](docs/research/2026-11-ai-ecosystem-consolidation.md):
  an English summary of a Deep Research report on consolidating a personal agent ecosystem across
  Android and Linux, with a fact-check and Claude's assessment. The
  [roadmap issues](https://github.com/sparesparrow/mcp-prompts/issues/136) come from it.

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

## Claude Code plugin

The plugin starts the server for you, asks for your settings once, and adds three skills that do the tool calls:

```
/plugin install mcp-prompts --marketplace sparesparrow/mcp-prompts
```

Or in two steps: `/plugin marketplace add sparesparrow/mcp-prompts`, then `/plugin install mcp-prompts@sparesparrow`.

Claude Code then asks for these settings; change them later in `/config`:

| Setting | What it does |
|---|---|
| Package registry | `github` (default) or `npm`. Both serve the same build. `npm` needs no token and is the one that works in cloud sessions. |
| GitHub token | A classic personal access token with `read:packages`, used only with `github`. Claude Code keeps it in secure storage and passes it to npm in `NODE_AUTH_TOKEN`; it is never written to a file. |
| Your prompts folder | Your own prompt JSON files, loaded on top of the bundled ones (`PROMPTS_EXTRA_DIRS`). A prompt with the same `id` replaces the bundled one. |
| Default tags | Comma-separated tags the skills search unless you name others, such as `mia-dev`. |
| Preferred language | `any`, `cs` or `en`: which version to pick when a prompt exists in more than one language. |
| Shared catalog URL | An `https` URL of a JSON catalog, such as one on GitHub Pages (`PROMPTS_CATALOG_URL`). |

The skills:

- `/mcp-prompts:find-prompt` searches by your default tags, a search text and your language.
- `/mcp-prompts:use-prompt <id>` asks for each template variable, fills the template and checks that no `{{` is left.
- `/mcp-prompts:save-prompt` writes a prompt as a JSON file into your folder. Unlike the `add_prompt` tool, which
  keeps it in memory only, the file outlasts a restart. Reconnect the server in `/mcp` to load it.

The plugin runs the server with `npx`, pinned to the plugin's version. For that one command it uses its own npm
settings file (`plugin/npmrc/`) instead of your `~/.npmrc`, so a registry mirror or proxy set there is not used.

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

The package ships the prompts in `data/prompts`, and the server finds them wherever an MCP client starts it from. Three environment variables change what it loads, each layer replacing the one before it for prompts with the same `id`:

| Variable | What it loads |
|---|---|
| `PROMPTS_DIR` | A directory used *instead of* the bundled prompts. |
| `PROMPTS_CATALOG_URL` | A JSON catalog fetched once at start: an array of prompts, or `{ "prompts": [...] }`. It must be `https` (plain `http` only to `localhost`). The server waits at most 5 s and reads at most 1 MB, and it skips entries that are not valid prompts. If the fetch fails, the other prompts stay. |
| `PROMPTS_EXTRA_DIRS` | Your own directories, separated by `:` (`;` on Windows), loaded last. |

`get_stats` reports how many prompts came from each source (`bundled`, `catalog`, `user`, and `session` for prompts added with `add_prompt`).

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

### Install a profile

By default an install serves every bundled prompt. No call returns them all at once: `list_prompts`
gives 20 summaries a page (at most 50, descriptions cut to 110 characters) and `list_categories`
says what each part of the library holds, so an agent starts there and asks for one category. A
**profile** serves only the prompts one kind of work needs, so its categories and pages are that
much smaller:

| Profile | For | Prompts |
|---|---|---|
| `software-dev` | Analysing and reviewing a software project | 13 |
| `embedded-iot` | Firmware, Raspberry Pi, Android and device bridges | 11 |
| `mia-vehicle` | The MIA in-car assistant at run time | 8 |
| `voice-home` | Voice commands and home automation | 13 |
| `learning-loop` | The self-improvement loop | 8 |
| `android-automation` | Natural-language control of an Android phone: app agents, Termux, PRoot, scenarios | 15 |
| `tasker-automation` | Building and maintaining Tasker: architecture, profiles, tasks, audits, direct edits | 7 |

```bash
claude mcp add -s user mcp-prompts -- mcp-prompts --profile software-dev
mcp-prompts profiles          # what each profile serves, and which prompts are in none
```

Several names (`--profile software-dev,embedded-iot`) serve the prompts of any of them. The
profiles live in [`data/prompts/profiles.json`](data/prompts/profiles.json);
[deploy/README.md](deploy/README.md) says what is in each, how the sizes were measured, how to
install one over Docker or HTTP, and how to change or add one.
The two phone profiles, `android-automation` and `tasker-automation`, have their own guide:
[docs/10-android-automation.md](docs/10-android-automation.md) explains the stack they are written
for, an example client config, every prompt in them, four worked scenarios and the safety model.

### Choose what gets installed

Beyond the profiles, you can choose yourself (the [install page](https://sparesparrow.github.io/mcp-prompts/)
does it with checkboxes and writes the options below for you):

- which **plain prompts** and which **templates** to serve (two separate lists);
- which **MCP capabilities** expose them: `tools`, `prompts` (each prompt becomes a slash command, with a template's variables as its arguments) and `resources` (each prompt is readable as `prompts://<id>`, for attaching as context);
- whether the install is **read-only** (no `add_prompt`, `update_prompt` or `delete_prompt`).

The same options go in the install command, the client config file, a dedicated config file or the URL:

| Option | Flag | Environment | Config file | URL (`/mcp?…`) |
|---|---|---|---|---|
| Profiles to serve | `--profile` | `MCP_PROMPTS_PROFILE` | `profile` | `profile` |
| Plain prompts to serve | `--prompts` | `MCP_PROMPTS_PROMPTS` | `prompts` | `prompts` |
| Templates to serve | `--templates` | `MCP_PROMPTS_TEMPLATES` | `templates` | `templates` |
| Leave out of both | `--exclude` | `MCP_PROMPTS_EXCLUDE` | `exclude` | `exclude` |
| Capabilities (default `tools`) | `--expose` | `MCP_PROMPTS_EXPOSE` | `expose` | `expose` |
| Read-only | `--read-only` | `MCP_PROMPTS_READ_ONLY` | `readOnly` | `readOnly` |
| Library instead of the bundled one | `--prompts-dir` | `PROMPTS_DIR` | `promptsDir` | – |
| Your own directories, served in full | `--dir` (repeat) | `MCP_PROMPTS_DIRS` | `dirs` | – |
| Save changes to a directory | `--state-dir` | `MCP_PROMPTS_STATE_DIR` | `stateDir` | – |
| Config file | `--config` | `MCP_PROMPTS_CONFIG` | – | – |

A list is comma-separated, and its entries can be:

- `all` (the default for each list) or `none`;
- a **group**, meaning a directory of the library such as `mia-car` (`cognitive` also covers `cognitive/meta`);
- a prompt **id**;
- `tag:<tag>`.

Flags override environment variables, which override the config file. Paths in a config file are relative to that file. The lists narrow a profile when both are given. Only the library is filtered: prompts in your own `--dir` directories, and prompts added while the server runs, are always served. An own prompt with a library prompt's id replaces it.

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

# Docker: the mcp tag is the stdio server; options go after the image name or in the environment
docker run --rm -i ghcr.io/sparesparrow/mcp-prompts:mcp --prompts none --templates mia-car --expose tools,prompts
docker run --rm -i -e MCP_PROMPTS_PROFILE=mia-vehicle ghcr.io/sparesparrow/mcp-prompts:mcp

# URL, against a server started with mcp-prompts-http (see HTTP Mode)
claude mcp add -s user --transport http mcp-prompts "http://localhost:3003/mcp?prompts=none&templates=mia-car,openclaw&expose=tools,prompts&readOnly=true"
```

A URL chooses from what that server serves. It can narrow the server's selection and turn read-only on, but it cannot widen the selection, turn read-only off, or name directories. Mistyped options, and a profile the library does not have, stop the server with exit code 2, and a URL with them gets HTTP 400. An entry that matches nothing, or matches only the other list (`--prompts mia-car` when mia-car holds only templates), is logged as a warning.

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

Prompts added or changed through `add_prompt` / `update_prompt` live in memory and are lost when the server restarts, unless the server has a state directory: with `--state-dir ~/.local/share/mcp-prompts` each change is saved there as a JSON file and loaded at the next start. Every MCP client on a machine starts its own server; pointed at the same directory they see each other's changes without a restart. `get_stats` says which applies (`"storage": "file"`, `"postgres"` or `"memory"`). Several servers can instead save to one Postgres database: set `MCP_PROMPTS_STORAGE=postgres`, `DATABASE_URL` and `MCP_PROMPTS_OWNER` (see [deploy/README.md](deploy/README.md#save-changes-to-postgres-optional)). A prompt that belongs in the bundled library is a JSON file under `data/prompts/` with a stable id, added by pull request.

## HTTP Mode

The same prompts are also available as a JSON API, for clients that don't speak MCP:

```bash
pnpm build
PORT=3003 pnpm start:http
# or: mcp-prompts-http, or the default Docker image (port 3003), or: docker compose up -d --wait --build
```

It listens on `127.0.0.1` unless `HOST` says otherwise.

| Method and path | Does |
|---|---|
| `GET /health`, `/ready`, `/version` | Liveness; readiness and mode (`readOnly`, `auth`, `storage`); package version |
| `GET /v1/prompts?tags=a,b&search=text&category=c&isTemplate=true&limit=20&offset=0` | List prompt summaries, 20 by default and at most 50 (`limit` above 50 is a 400), with `total` and `has_more` |
| `POST /v1/prompts` | Add a prompt (same fields as `add_prompt`) |
| `GET` / `PUT` / `DELETE /v1/prompts/:id` | Read, update or delete one prompt |
| `POST /v1/prompts/:id/apply` | Fill a template: `{ "variables": { ... } }` → `{ "result": "...", "missing": [], "unused": [] }` |
| `GET /v1/stats` | Same counts as `get_stats` |
| `GET /mcp/tools`, `POST /mcp/tools/:name` | Call any MCP tool by name: `{ "arguments": { ... } }` |
| `POST /mcp?…` | MCP itself (Streamable HTTP, stateless), for `claude mcp add --transport http`; the query string chooses a profile, prompts, templates and capabilities (see [Install a profile](#install-a-profile)) |

```bash
curl -s -X POST localhost:3003/v1/prompts/claudepy-esp32-android-bridge-workflow/apply \
  -H 'Content-Type: application/json' -d '{"variables":{"esp32_firmware_path":"./firmware"}}'
```

`mcp-prompts-http` takes the same options as `mcp-prompts` (flags, environment, `--config`); they set what the whole server serves. With `--read-only`, the write routes and tools are left out.
Invalid input answers 400, unknown prompts 404, a taken id 409. Set `CORS_ORIGIN` to allow browser clients.
Changes made over HTTP live in memory, like those made over MCP, unless `--state-dir` is set; the files in `data/prompts` are never rewritten.

Prompts are instructions agents act on, so the server is careful about who may change them:

- `MCP_PROMPTS_AUTH_TOKEN` (or `MCP_PROMPTS_AUTH_TOKEN_FILE`): when set, every request except `/health`, `/ready` and `/version` must send `Authorization: Bearer <token>`.
- Listening beyond loopback (`HOST=0.0.0.0`) with writes enabled and no token is refused at start. Serve read-only, set a token, or set `MCP_PROMPTS_ALLOW_INSECURE=true` behind a proxy that authenticates.
- `MCP_PROMPTS_ALLOWED_HOSTS` and `MCP_PROMPTS_ALLOWED_ORIGINS` list the Host names and browser origins to accept; on loopback only loopback names are.
- The Docker image is read-only unless `MCP_PROMPTS_READ_ONLY=false` is set together with a token.

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
| `list_categories` | Start here: the categories this server serves, with the number of prompts and templates in each |
| `list_prompts` | List prompt summaries, filtered by category, tags, kind or a search term, a page at a time (default 20, at most 50, `has_more` and `next_offset` lead to the rest) |
| `get_prompt` | Retrieve a prompt by ID |
| `add_prompt` | Add a new prompt or template |
| `update_prompt` | Modify existing prompt |
| `delete_prompt` | Remove prompt |
| `apply_template` | Fill a template prompt's `{{variables}}`, naming any left unfilled |
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
├── learned/              # prompts produced by the learning loop
└── profiles.json         # the profiles: which of the above each kind of work gets
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
pnpm run site      # Rebuild the install page (index.html) from site/; see site/README.md
```

## Enterprise Deployment

For enterprise features (AWS, multi-tenant, payments), see [archive/aws/README.md](archive/aws/README.md).

Most users don't need this - the local MCP server is sufficient.

## License

MIT
