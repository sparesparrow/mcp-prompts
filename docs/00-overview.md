# Overview

This document provides a high-level overview of MCP-Prompts, its goals and architecture.

> **Note**: The full overview is still being migrated from the original README. For now refer to [`docs/LEGACY_README.md`](LEGACY_README.md) for exhaustive details.

MCP-Prompts is an **MCP server** responsible for storing, versioning and delivering prompts and templates to AI clients. Core responsibilities:

1. **Centralised storage** – avoid prompt duplication across projects.
2. **Template application** – substitute variables server-side for consistent output.
3. **Multi-adapter backend** – choose between file, PostgreSQL, MDC… and more.
4. **Resource aware** – integrate with other MCP servers (memory, filesystem, GitHub…).
5. **Dev ergonomics** – CLI, API, quick-start images, rich docs.

See the [Quick-Start](01-quickstart.md) to get running. 