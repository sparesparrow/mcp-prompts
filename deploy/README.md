# Profiles: install only the prompts one kind of work needs

The bundled library holds prompts for very different work: reviewing a web backend, building
ESP32 firmware, running the MIA car assistant, understanding voice commands. An install that
serves all of it makes every `list_prompts` call return all of it, and offers an agent that is
reviewing Python code a prompt for car climate control.

A **profile** is a named selection kept with the library, in
[`data/prompts/profiles.json`](../data/prompts/profiles.json). An install that names one serves
only those prompts; the rest do not exist for it.

| Profile | For | Prompts | One `list_prompts` call returns | Of the whole library |
|---|---|---|---|---|
| `software-dev` | Analysing and reviewing a software project | 13 | 2,175 characters | 21% |
| `embedded-iot` | Firmware, Raspberry Pi, Android and device bridges | 11 | 2,389 | 23% |
| `mia-vehicle` | The MIA in-car assistant at run time | 8 | 1,362 | 13% |
| `voice-home` | Voice commands and home automation | 13 | 3,865 | 37% |
| `learning-loop` | The self-improvement loop | 8 | 1,111 | 11% |
| (none) | Everything | 49 | 10,397 | 100% |

The sizes are the text of a `list_prompts` result with no filter, measured through an MCP client
against this library. The structured copy of the result that the tool also returns shrinks by the
same share (16,913 characters without a profile). `mcp-prompts profiles` prints the current counts.

## Install a profile

The server takes the profile's name wherever it takes its other options:

```bash
# Claude Code, every project
claude mcp add -s user prompts -- mcp-prompts --profile software-dev

# Docker (the stdio image; arguments after the image name go to the server)
claude mcp add -s user prompts -- docker run -i --rm --network none ghcr.io/sparesparrow/mcp-prompts:mcp --profile software-dev

# One HTTP server for everyone; each client names its profile in its URL
claude mcp add -s user --transport http prompts "http://localhost:3003/mcp?profile=software-dev"
```

In a client config (`.mcp.json`, `claude_desktop_config.json`, Cursor):

```json
{
  "mcpServers": {
    "prompts": { "command": "npx", "args": ["-y", "@sparesparrow/mcp-prompts", "--profile", "software-dev"] }
  }
}
```

Also: the environment variable `MCP_PROMPTS_PROFILE=software-dev`, and `"profile": "software-dev"`
in a `--config` file. `mcp-prompts config --profile software-dev` prints all of these ready to
paste, and `mcp-prompts catalog --profile software-dev` lists exactly what the install will serve.

A project's own `.mcp.json` is the natural place: the MIA repository installs `embedded-iot`, a web
service installs `software-dev`, and neither pays for the other's prompts.

The HTTP server is `mcp-prompts-http`, or from a checkout `docker compose up -d --wait --build`
([`docker-compose.yml`](../docker-compose.yml): read-only, on this machine only). It can serve the
whole library and leave the choice to each URL, or be limited itself with `MCP_PROMPTS_PROFILE`.

## What each profile serves

**`software-dev`** (13 plain prompts). An orchestrator for each project type that
`scripts/orchestrate-project.sh` detects (Android app, C++ backend, DevOps infrastructure, embedded
IoT, generic, multi-platform IoT, Python backend, web backend, web frontend), the three analyst
subagents (architecture, security, tests) and `software-design-life-story-analogy`. No templates
and nothing about vehicles, voice or home automation.

**`embedded-iot`** (6 plain, 5 templates). The orchestrators for embedded IoT, multi-platform IoT
and Android apps, the three analyst subagents, the two claudepy workflows (Android build-test cycle,
ESP32-Android bridge), `mia-gpio-config`, and the MIA repository's pull-request workflow
(`mia-pr-merge-gate`, `mia-subagent-pr-brief`).

**`mia-vehicle`** (8 templates). The seven `mia-car` templates (climate, diagnostics, emergency,
maintenance, navigation, voice command, voice response) and `mia-gpio-config`. This is what the
assistant in the car needs at run time; nothing for developing it.

**`voice-home`** (1 plain, 12 templates). The `voice-intelligence` group (the MIA system identity,
voice-command learning, pattern and knowledge synthesis, failure analysis, context analysis,
implicit-reference resolution, light feedback, design principles), the three OpenClaw templates
(agent router, cron failure recovery, weekly health summary) and the home command interpreter.

**`learning-loop`** (7 plain, 1 template). The seven cognitive-layer instructions (perception,
episodes, semantic, procedures, meta, transfer, evaluation) and `learning-loop-analyzer`.

**In no profile** (served only without one): `gamepad-dynamic-remapper` (desktop control, none of
these kinds of work), `analysis-assistant` (a demonstration prompt) and
`ai-self-improvement-orchestrator` (its placeholders are Jinja expressions that `apply_template`
cannot fill, so it always comes back incomplete).

## Combine and narrow

- **Several profiles** serve the prompts of any of them: `--profile software-dev,embedded-iot`
  serves 18 prompts (the analysts and three orchestrators are in both).
- **The other options narrow a profile**, they never widen it: `--profile voice-home --exclude openclaw`
  drops the three templates of the `openclaw` group; `--profile embedded-iot --templates claudepy-workflows` keeps the
  profile's plain prompts and only those two templates.
- **A URL narrows its server**: with the server limited to `MCP_PROMPTS_PROFILE=software-dev,embedded-iot`,
  `?profile=embedded-iot` serves that profile, and `?profile=mia-vehicle` serves only what both
  share (`mia-gpio-config`).
- A name the library does not have stops the server with exit code 2 (a URL gets HTTP 400), and
  the message lists the profiles there are.

## What a profile does not limit

Only the library is filtered. Prompts in your own `--dir` directories, and prompts added through
`add_prompt`, are served by every install whatever its profile. With a shared `--state-dir` that
means a prompt one agent saves appears in every profile.

## Other ways to keep calls small

- Leave `--expose` at `tools` unless you want slash commands: with `prompts`, a client loads the
  name, description and arguments of every prompt when it connects.
- `list_prompts` takes `tags`, `category`, `isTemplate`, `search` and `limit`; a filtered call
  returns less than an unfiltered one in any profile.
- `--read-only` leaves out three tool definitions (`add_prompt`, `update_prompt`, `delete_prompt`).

## Change a profile, or add one

Edit [`data/prompts/profiles.json`](../data/prompts/profiles.json). A profile has a `description`,
a `prompts` list for plain prompts, a `templates` list for templates, and optionally `exclude`.
Entries are what `--prompts` and `--templates` take: a group (a directory of the library; `cognitive`
also covers `cognitive/meta`), a prompt id, or `tag:<tag>`; `"all"` and `"none"` are allowed in
place of a list. A group entry picks up prompts added to that directory later; an id does not.

```json
"web-backend": {
  "description": "Reviewing a web service.",
  "prompts": ["orchestration_main_web_backend", "orchestration_main_python_backend", "subagents"],
  "templates": "none"
}
```

`mcp-prompts profiles` then shows what it serves and warns about entries that match nothing. The
tests in `src/prompt-store.test.ts` ("bundled profiles") fail when a bundled profile has such an
entry, grows past 15 prompts, or lets a vehicle, voice or home prompt into `software-dev`.

A library of your own (`--prompts-dir`) gets profiles the same way: a `profiles.json` at its root.

## Check an install

[`smoke-test.mjs`](smoke-test.mjs) connects the way a client does and fails if the install serves
more than you intended:

```bash
node deploy/smoke-test.mjs --max-prompts 15 -- mcp-prompts --profile software-dev
node deploy/smoke-test.mjs --max-prompts 15 --url "http://localhost:3003/mcp?profile=mia-vehicle"
```
