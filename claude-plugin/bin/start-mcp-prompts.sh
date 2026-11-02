#!/usr/bin/env sh
# Starts the mcp-prompts stdio server for the Claude Code plugin.
#
# Prompts are read from MCP_PROMPTS_DIR when it is set (your own folder), otherwise from the
# starter prompts that ship with the plugin. The server version is pinned here and checked by
# src/claude-plugin.test.ts against .claude-plugin/plugin.json.
set -eu

plugin_root=$(cd "$(dirname "$0")/.." && pwd)
version=4.0.2

export PROMPTS_DIR="${MCP_PROMPTS_DIR:-$plugin_root/prompts}"
exec npx -y "@sparesparrow/mcp-prompts@$version"
