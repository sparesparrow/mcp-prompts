# Roadmap

_Last updated: 2025-04-18_

## Q2 / 2025

| Item                          | Details                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| ElasticSearch storage adapter | Import/export from JSONL / Markdown ↔︎ index with k-NN search                   |
| CLI `import` command          | `mcp-prompts import --format=jsonl --file ./all-prompts.jsonl --storage elastic` |
| SSE refactor                  | Switch to standards-compliant `EventSource` implementation & Claude 3 tests      |

## Q3 / 2025

| Item                      | Details                                                    |
| ------------------------- | ---------------------------------------------------------- |
| HTTP API v2               | OpenAPI-driven spec, versioned endpoints                   |
| `mcp-prompts init` wizard | Scaffold workspace, `.env`, sample prompts                 |
| Unified search            | Full-text + vector in one endpoint (`?q=` & `?neighbour=`) |

## Backlog / Ideas

- **Orchestrator integration** for multi-step workflows.
- **Mermaid diagram server** bundled image.
- **gRPC transport** (exploration).
- **VS Code extension** for in-editor prompt management.

---

Pull requests are welcome for any roadmap item. Open an issue to discuss implementation details before starting major work.
