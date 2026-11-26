#!/usr/bin/env bash
# One source of rules and skills for several coding CLIs (mcp-prompts issue #139).
#
# The source is a directory holding AGENTS.md (the rules) and skills/<name>/SKILL.md (Agent
# Skills, https://agentskills.io). This script links them into the places each CLI reads, so an
# edit in the source reaches every CLI and nothing is copied.
#
# User mode (the default) links into the home directory:
#   Claude Code  ~/.claude/CLAUDE.md imports the rules with an "@<source>/AGENTS.md" line;
#                skills are linked into ~/.claude/skills/<name>
#   Codex        ~/.codex/AGENTS.md (or $CODEX_HOME) is linked; skills into ~/.agents/skills/<name>
#   opencode     ~/.config/opencode/AGENTS.md is linked, when ~/.config/opencode exists
#                (it finds the skills in ~/.claude/skills or ~/.agents/skills)
#   Qwen Code    ~/.qwen/QWEN.md is linked to AGENTS.md, when ~/.qwen exists
#
# Project mode (--project DIR) links into a repository. Keep the source in the repository itself
# (--source DIR --project DIR): AGENTS.md is then a real file there, CLAUDE.md imports it with
# "@AGENTS.md", and the skills are linked into .claude/skills and .agents/skills with relative
# links that work in every clone. Claude Code follows an import that leaves the project only after
# someone approves it in an interactive session (claude -p skips it), so with a source outside the
# project the script links AGENTS.md but warns.
#
# It never replaces a file or directory it did not create: an existing real file, or a link that
# points outside the source, is reported and left alone. Remove it yourself to let the link in.
#
# Usage:
#   sync.sh [--source DIR] [--export PROFILE] [--project DIR] [--prune] [--dry-run]
#     --source DIR      the source directory (default: $AGENT_RULES_DIR or ~/.agent-rules)
#     --export PROFILE  first run "mcp-prompts export --skills DIR/skills --profile PROFILE"
#                       ($AGENT_RULES_MCP_PROMPTS, default mcp-prompts, is the command used)
#     --project DIR     link into this project instead of the home directory
#     --prune           also remove links into the source whose skill no longer exists
#     --dry-run         print what would change and change nothing
set -euo pipefail

SOURCE="${AGENT_RULES_DIR:-$HOME/.agent-rules}"
PROFILE=""
PROJECT=""
PRUNE=0
DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2 ;;
    --export) PROFILE="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --prune) PRUNE=1; shift ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "sync.sh: unknown argument $1 (see --help)" >&2; exit 2 ;;
  esac
done

SOURCE="$(cd "$SOURCE" 2>/dev/null && pwd -P)" || { echo "sync.sh: source directory not found" >&2; exit 2; }
SKILLS="$SOURCE/skills"
RULES="$SOURCE/AGENTS.md"
WARNINGS=0

say() { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; WARNINGS=$((WARNINGS + 1)); }
run() { if [ "$DRY" = 1 ]; then say "would: $*"; else "$@"; fi; }
did() { [ "$DRY" = 1 ] || say "$*"; }

if [ -n "$PROFILE" ]; then
  # shellcheck disable=SC2086 # AGENT_RULES_MCP_PROMPTS may be a command with arguments.
  run ${AGENT_RULES_MCP_PROMPTS:-mcp-prompts} export --skills "$SKILLS" --profile "$PROFILE"
fi

# points_into_source LINK: whether the link's target (as written) is inside the source.
points_into_source() {
  local target
  target="$(readlink "$1")"
  case "$target" in /*) ;; *) target="$(dirname "$1")/$target" ;; esac
  target="$(cd "$(dirname "$target")" 2>/dev/null && pwd -P)/$(basename "$target")" || return 1
  case "$target" in "$SOURCE"/*) return 0 ;; *) return 1 ;; esac
}

# link TARGET LINK: make LINK a symbolic link to TARGET unless something else is already there.
link() {
  local target="$1" at="$2"
  if [ -L "$at" ]; then
    [ "$(readlink "$at")" = "$target" ] && return 0
    if points_into_source "$at" || [ ! -e "$at" ]; then
      run ln -sfn "$target" "$at"; did "relinked $at"
    else
      warn "$at links to $(readlink "$at"), not into the source; left alone"
    fi
  elif [ -e "$at" ]; then
    warn "$at exists and is not a link; left alone"
  else
    run mkdir -p "$(dirname "$at")"
    run ln -s "$target" "$at"
    did "linked $at"
  fi
}

# link_skills DIR [PREFIX]: link every skill of the source into DIR (through PREFIX, a relative
# path to the skills, when given), and with --prune remove links to skills that are gone.
link_skills() {
  local into="$1" prefix="${2:-$SKILLS}" skill name entry
  if [ -d "$SKILLS" ]; then
    for skill in "$SKILLS"/*/; do
      [ -f "$skill/SKILL.md" ] || continue
      name="$(basename "$skill")"
      link "$prefix/$name" "$into/$name"
    done
  fi
  if [ "$PRUNE" = 1 ] && [ -d "$into" ]; then
    for entry in "$into"/*; do
      [ -L "$entry" ] && [ ! -e "$entry" ] || continue
      case "$(readlink "$entry")" in
        "$prefix"/*) run rm "$entry"; did "pruned $entry" ;;
      esac
    done
  fi
}

# import_rules FILE LINE: make sure the Claude Code memory FILE contains the import LINE.
import_rules() {
  local file="$1" line="$2"
  if [ -f "$file" ] && grep -qxF "$line" "$file"; then return 0; fi
  if [ "$DRY" = 1 ]; then say "would: add \"$line\" to $file"; return 0; fi
  mkdir -p "$(dirname "$file")"
  if [ -s "$file" ]; then printf '\n%s\n' "$line" >> "$file"; else printf '%s\n' "$line" > "$file"; fi
  say "added $line to $file"
}

[ -f "$RULES" ] || warn "$RULES does not exist; only skills are linked"

if [ -n "$PROJECT" ]; then
  PROJECT="$(cd "$PROJECT" && pwd -P)"
  if [ -f "$RULES" ]; then
    if [ "$PROJECT" != "$SOURCE" ]; then
      link "$RULES" "$PROJECT/AGENTS.md"
      warn "the source is outside $PROJECT: Claude Code loads its AGENTS.md only after you approve the import in an interactive session; claude -p skips it until then"
    fi
    import_rules "$PROJECT/CLAUDE.md" "@AGENTS.md"
  fi
  if [ "$PROJECT" = "$SOURCE" ]; then
    link_skills "$PROJECT/.claude/skills" "../../skills"
    link_skills "$PROJECT/.agents/skills" "../../skills"
  else
    link_skills "$PROJECT/.claude/skills"
    link_skills "$PROJECT/.agents/skills"
  fi
else
  if [ -f "$RULES" ]; then
    import_rules "$HOME/.claude/CLAUDE.md" "@$RULES"
    link "$RULES" "${CODEX_HOME:-$HOME/.codex}/AGENTS.md"
    if [ -d "$HOME/.config/opencode" ]; then link "$RULES" "$HOME/.config/opencode/AGENTS.md"; fi
    if [ -d "$HOME/.qwen" ]; then link "$RULES" "$HOME/.qwen/QWEN.md"; fi
  fi
  link_skills "$HOME/.claude/skills"
  link_skills "$HOME/.agents/skills"
fi

[ "$WARNINGS" = 0 ] || { say "$WARNINGS warning(s); see above."; exit 1; }
