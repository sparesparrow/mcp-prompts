# @mcp-prompts/adapters-file

Souborový adapter pro MCP server.

- Implementuje porty z `@mcp-prompts/core`
- Ukládá data do souborového systému

## Robustness Features

- **Atomic writes**: All prompt files are written atomically (temp file + rename)
- **File locking**: Prevents concurrent write corruption (proper-lockfile)
- **Schema validation**: All prompt files validated with Zod
- **Indexing**: Maintains index.json for fast listing
- **Robustness tests**: See tests/file-adapter-robustness.test.ts
