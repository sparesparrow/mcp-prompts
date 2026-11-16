# Evaluation

[`mcp-prompts.xml`](mcp-prompts.xml) holds ten questions a model should be able to answer using
only this server's tools, each with one answer checked by string comparison. They are read-only
and independent, and several need more than one call (list a category, read each prompt, compare).

Run them against the whole bundled library: `mcp-prompts` with no profile and no selection.

The answers depend on the library's contents. After changing prompts, re-derive them:

```bash
pnpm run build && node evaluations/verify.mjs
```

It answers each question through a real MCP client and fails when an answer in the file no longer
holds.
