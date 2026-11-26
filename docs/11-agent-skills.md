# Agent Skills: one source of rules and skills for every CLI

Claude Code, Codex, opencode, Qwen Code and the others each read rules and skills from their own
places: `CLAUDE.md` and `.claude/skills`, `AGENTS.md` and `.agents/skills`, `QWEN.md`, and so
on. When those files are copies, they drift. This page describes one source layout, the
mcp-prompts commands that move prompts into it and back, and a script that links the source into
each CLI's place, so nothing is copied ([#139](https://github.com/sparesparrow/mcp-prompts/issues/139)).

## The source layout

```
<source>/
├── AGENTS.md                  # the rules, in plain Markdown
└── skills/
    └── <name>/
        ├── SKILL.md           # an Agent Skill (https://agentskills.io/specification)
        └── scripts/ …         # optional files of the skill
```

The source can be a directory of its own (for example `~/.agent-rules`, for rules that apply
everywhere) or a repository (for rules of one project).

## Prompts to skills: `mcp-prompts export`

```bash
mcp-prompts export --skills ~/.agent-rules/skills --profile android-automation
mcp-prompts export --skills ./skills --prompts none --templates tasker --json
```

`export` takes the same selection options as the server (`--profile`, `--prompts`, `--templates`,
`--exclude`, `--dir`, …) and writes each selected prompt as `<dir>/<name>/SKILL.md`:

| Prompt | Skill |
|---|---|
| `id` | `name`: the id lowercased, with any other character turned into `-` and cut to 64 characters (`orchestration_main_generic` becomes `orchestration-main-generic`). Two ids with the same name get `-2`, `-3`. |
| `description` | `description`, shortened at a sentence to the 1024 characters a skill allows. A prompt with no description gets its name. |
| `content` | the body, unchanged. |
| a template's `variables` | a **Parameters** section at the top of the body that tells the agent to fill each `{{name}}` first, between two `<!-- mcp-prompts:… -->` marker comments. |
| everything else (`name`, `tags`, `category`, `variables`, `version`, dates, the full description when it was shortened, …) | `metadata.mcp-prompts-prompt`, as JSON, next to `metadata.mcp-prompts-id`. |

The skills pass the reference validator (`pip install skills-ref`, then
`agentskills validate <dir>/<name>`); all 80 prompts of the bundled library do.

`export` replaces a `SKILL.md` only when it exported that file from the same prompt before. A
skill written by hand, or one exported from another prompt, is left alone and reported, and the
command then exits with 1. Other files in the directory are never touched, and a skill whose
prompt is gone is not deleted.

## Skills to prompts: `--dir`

A `--dir` directory (and a `--prompts-dir` library) may hold skill folders beside JSON prompt
files. A directory with a `SKILL.md` is one prompt; the rest of that folder belongs to the skill
and is not read as prompts.

```bash
mcp-prompts --dir ~/.agent-rules/skills                 # serve the skills as prompts
mcp-prompts catalog --prompts none --templates none --dir ~/.claude/skills
```

- A skill that `export` wrote comes back as the same prompt: same id, fields and content (a
  round-trip test over the whole bundled library checks this). The frontmatter description is
  used unless it was a shortened or stand-in copy; to change a long description, change it in the
  prompt and export again.
- A skill written by hand becomes a prompt with the skill's name as id and name, its description,
  its body as content and the tag `skill`. Other frontmatter fields (`license`, `compatibility`,
  `allowed-tools`, `metadata`) are kept under `metadata.skill`.
- A `SKILL.md` without frontmatter is skipped with a warning.

## Linking the source into each CLI: `contrib/agent-rules/sync.sh`

The script is in the repository, not in the npm package. It links; it never copies, and it never
replaces a file or a link it did not make (it reports those and exits with 1).

```bash
# User mode: rules and skills for every project
contrib/agent-rules/sync.sh --source ~/.agent-rules --export android-automation

# Project mode, with the source in the repository itself
contrib/agent-rules/sync.sh --source . --project .

# See what it would do, and remove links to skills that are gone
contrib/agent-rules/sync.sh --source ~/.agent-rules --dry-run --prune
```

| CLI | User mode | Project mode (source = project) |
|---|---|---|
| Claude Code | `~/.claude/CLAUDE.md` gets `@<source>/AGENTS.md`; skills linked into `~/.claude/skills/` | `CLAUDE.md` gets `@AGENTS.md`; skills linked into `.claude/skills/` |
| Codex | `~/.codex/AGENTS.md` (or `$CODEX_HOME`) linked; skills into `~/.agents/skills/` | reads `AGENTS.md`; skills linked into `.agents/skills/` |
| opencode | `~/.config/opencode/AGENTS.md` linked, when that directory exists; it finds the skills in `~/.claude/skills/` or `~/.agents/skills/` | reads `AGENTS.md` and the linked skills |
| Qwen Code | `~/.qwen/QWEN.md` linked to `AGENTS.md`, when `~/.qwen` exists | – |

In project mode the skill links are relative (`.claude/skills/x -> ../../skills/x`), so they work
in every clone. `--export PROFILE` runs `mcp-prompts export` into `<source>/skills` first
(`AGENT_RULES_MCP_PROMPTS` names another command, such as `npx -y @sparesparrow/mcp-prompts`).

Two things we found about Claude Code (2.1.332) while checking this:

- **Imports that leave the project need an approval.** A project `CLAUDE.md` that imports a file
  outside the project, directly or through a symbolic link, is followed only after someone
  approves it in an interactive session; `claude -p` skips it silently. Keep the source inside
  the repository for project mode. The script warns when it is not. The user's own
  `~/.claude/CLAUDE.md` may import from anywhere.
- **A lone `AGENTS.md` was not read** in our tree, where a parent directory has a `CLAUDE.md`.
  The `@AGENTS.md` import is the reliable way, so the script always adds it.

## How it was checked

On the phone (Debian in PRoot, aarch64), 2026-11-26, with Claude Code 2.1.332 and opencode 1.19.6.
Codex 0.171.0 was set up as well, but its account was over its usage limit that day.

1. A source with an `AGENTS.md` holding one rule ("When someone asks for the project codeword,
   answer exactly: PERIWINKLE-42") and the 15 skills of `--profile android-automation`, written
   with `mcp-prompts export`.
2. Project mode: `sync.sh --source <repo> --project <repo>` in a fresh git repository.
   User mode: `HOME=<empty home> sync.sh --source <source>`, with only the Claude credentials
   linked into that home.
3. In each, both CLIs were asked, without tools: "Line 1: the project codeword from your
   instructions, or NONE. Line 2: yes or no, is a skill named termux-api-commands available to
   you?" (`claude -p … --model haiku`, `opencode run -m opencode/big-pickle …`).
4. All four answers were `PERIWINKLE-42` / `yes`. Running the script a second time changed
   nothing.

Not checked: Qwen Code (not logged in on this phone) and Codex (usage limit). The paths the script
uses for them are the ones their binaries and documentation name.
