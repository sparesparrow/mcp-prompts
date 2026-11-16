# Install page

The page at <https://sparesparrow.github.io/mcp-prompts/>: choose a profile, plain prompts,
templates and MCP capabilities, and copy the matching `claude mcp add` command, client config
(Claude Desktop, Cursor, VS Code), `/mcp` URL or `mcp-prompts.json`.

## How it is published

GitHub Pages builds the repository's `main` branch with Jekyll. Two files at the repository root
belong to this page:

- `index.html` is this app, bundled into one file. It is generated: edit `site/src`, then run
  `pnpm run site` in the repository root and commit the new `index.html` with your change.
- `prompt-files.json` is a Jekyll template that lists the prompt files Pages publishes. The page
  reads it, then `data/prompts/profiles.json`, `package.json` and every prompt file, so it shows
  the library as it is on `main` without being rebuilt when prompts change.

When the live library cannot be read (the page opened from a file, or Pages unavailable), the page
uses `src/data/snapshot.json`, a copy made by the build, and says so at the top.

## It agrees with the server

`src/lib/library.ts` mirrors how the server loads files, groups prompts and applies profiles and
selections (`src/prompt-store.ts`). `src/lib/install.ts` ports `src/install-commands.ts`.
`pnpm run verify` (part of the build) runs the built server and fails when the page serves
different prompts than `mcp-prompts catalog`, or prints different lines than `mcp-prompts config`,
for a set of cases covering every profile and option.

## Commands

```bash
pnpm run site                  # in the repository root: build the server, then this page
pnpm --dir site run dev        # live development server (Vite); uses the snapshot
pnpm --dir site run verify     # compare with the built server only
```

The build is `snapshot` → `typecheck` → `verify` → `bundle` (Parcel, then html-inline into
`bundle.html`) → `pages` (writes `../index.html`). This directory is its own pnpm workspace, so
the server's install and CI never touch it.
