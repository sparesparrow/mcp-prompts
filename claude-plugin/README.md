# mcp-prompts plugin for Claude Code

A Claude Code plugin that wraps the [mcp-prompts](https://github.com/sparesparrow/mcp-prompts) server with a skill for using it. It gives Claude three things:

- the `mcp-prompts` MCP server, which lists, fills and stores prompts;
- the `prompt-library` skill, which tells Claude when to find a saved prompt, how to fill a template and how to save a new one;
- starter templates for code review, commit messages and pull request descriptions.

Everything is customisable. Point the plugin at your own prompts folder and it reads your prompts instead of the starters.

## Install

From this repository's marketplace:

```
/plugin marketplace add sparesparrow/mcp-prompts
/plugin install mcp-prompts@sparesparrow
```

Or from a local checkout:

```
/plugin marketplace add /path/to/mcp-prompts
/plugin install mcp-prompts@sparesparrow
```

The server starts with `npx -y @sparesparrow/mcp-prompts@4.0.2`, so Node.js 20 or later must be on your `PATH`.

## Use your own prompts

1. Create a folder for your prompts, for example `~/prompts`.
2. Set `MCP_PROMPTS_DIR` to that folder in the environment Claude Code starts in:
   ```sh
   export MCP_PROMPTS_DIR="$HOME/prompts"
   ```
3. Restart Claude Code. The server now reads prompts from your folder and ignores the starters.

To keep the starters and add your own, copy the files from `claude-plugin/prompts/` into your folder first.

### Prompt file format

Each prompt is one JSON file, and it can sit in any subfolder. Files named `index.json` are ignored.

```json
{
  "id": "meeting-notes",
  "name": "Meeting notes",
  "description": "Turns raw notes into decisions and actions.",
  "content": "Summarise these notes for {{audience}}:\n\n{{notes}}\n\nList decisions, then actions with owners.",
  "isTemplate": true,
  "tags": ["meetings", "writing"],
  "variables": [
    { "name": "audience", "description": "Who will read the summary", "required": true, "type": "string" },
    { "name": "notes", "description": "The raw notes", "required": true, "type": "string" }
  ]
}
```

- `id` must be unique across the folder, and the file name should match it.
- Each `{{name}}` in `content` should be listed in `variables`, and the reverse.
- `isTemplate` is `true` only when `content` has placeholders.

To check a new file, restart Claude Code and ask it to list prompts with the tag you used.

### Changes

- Editing a file takes effect after a restart.
- Prompts added through the `add_prompt` tool are kept in memory only and are lost when the server restarts. Save durable prompts as files.

## Update the pinned version

The version is pinned in `bin/start-mcp-prompts.sh` and in `.claude-plugin/plugin.json`. Both must match, and the test suite checks that they do. To move to a new release:

1. Change `version` in `.claude-plugin/plugin.json` and `version=` in `bin/start-mcp-prompts.sh`.
2. Change `version` in `../.claude-plugin/marketplace.json`.
3. Run `pnpm test`, then `claude plugin validate .` from the repository root.

## Develop and check

```sh
claude plugin validate claude-plugin
pnpm test -- claude-plugin
```

Only the stdio server is wrapped. For HTTP use, run `mcp-prompts-http` (or the Docker image) yourself and point Claude Code at it.
