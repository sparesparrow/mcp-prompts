# TODO – Hexagonal Refactor of **mcp-prompts**

> **Scope**  This checklist tracks every task needed to migrate the existing
> *mcp-prompts* repository to a clean Ports & Adapters (Hexagonal)
> architecture, publish the new multi-package workspace, and deprecate the
> legacy code-path.  Each task MUST be checked off before the **v3.0.0**
> release tag is cut.

---

## 0  Project-wide Conventions

- [ ] Source language = TypeScript 5.5 · `strict` mode enforced
- [ ] Package manager = pnpm v9 workspaces
- [ ] Code style = ESLint + Prettier (Airbnb base) – CI-guarded
- [ ] Unit tests = Vitest · 90 % line coverage threshold
- [ ] e2e tests = Playwright (HTTP) + MCP Inspector scripts (stdio)
- [ ] Conventional Commits + changesets for automated release notes

---

## 1  Repository Re-structure

| Path | Purpose | Status |
| ---- | ------- | ------ |
| `packages/core` | Domain entities, DTOs, ports, use-cases | [ ]
| `packages/adapters-file` | `IPromptRepository` file impl. | [ ]
| `packages/adapters-postgres` | Postgres impl. inc. pgvector | [ ]
| `packages/adapters-memory` | In-mem mock (tests) | [ ]
| `packages/adapters-mdc` | Cursor Rules MDC parser | [ ]
| `packages/adapters-eta` | `ITemplatingEngine` (Eta) | [ ]
| `packages/adapters-mcp` | Driving MCP server | [ ]
| `packages/adapters-rest` | Driving REST (Express) | [ ]
| `packages/adapters-cli` | Driving CLI (Commander) | [ ]
| `apps/server` | Composition root + DI | [ ]
| `docs` | Architecture, ADRs, diagrams | [ ]

- [ ] Monorepo bootstrapped with `pnpm init` and `pnpm workspaces`
- [ ] Root `tsconfig.json` with references to each package
- [ ] Path aliases (`@core/*`, `@adapters/*`)

---

## 2  Domain Modelling (`packages/core`)

### 2.1  Entities
- [ ] `Prompt`
- [ ] `Template`
- [ ] `Category`
- [ ] `User`

### 2.2  Value Objects & Utilities
- [ ] `PromptId` (UUID v7)
- [ ] `Tag` (string regex)
- [ ] `TemplateVariable`

### 2.3  Ports (Interfaces)
- [ ] **Primary** `IPromptApplication`
- [ ] **Secondary** `IPromptRepository`
- [ ] **Secondary** `ITemplatingEngine`
- [ ] **Secondary** `IEventPublisher`
- [ ] **Secondary** `ISecurityValidator`

### 2.4  Use-cases (Services)
- [ ] `addPrompt`
- [ ] `getPromptById`
- [ ] `listPrompts`
- [ ] `updatePrompt`
- [ ] `deletePrompt`
- [ ] `applyTemplate`
- [ ] `validatePrompt`

> All use-cases =
>  • pure functions  • no `console`  • 0 external imports outside ports

---

## 3  Driving Adapters (Inbound)

### 3.1  `packages/adapters-mcp`
- [ ] Scaffold with `@modelcontextprotocol/sdk` ≥ 1.6
- [ ] Stdio + SSE transport selection via env
- [ ] Zod schema validation on all requests
- [ ] Maps JSON-RPC → `IPromptApplication`
- [ ] Unit tests with MCP Inspector in CI

### 3.2  `packages/adapters-rest`
- [ ] Express 5 · async-handler middleware
- [ ] OpenAPI 3 spec auto-generated with `tsoa`
- [ ] Error-to-HTTP mapping (Factory)

### 3.3  `packages/adapters-cli`
- [ ] Commander.js interface (`mcp-prompts` cmd)
- [ ] Uses IPC to server or invokes core directly for offline ops

---

## 4  Driven Adapters (Outbound)

### 4.1  File Storage
- [ ] Secure path normalisation (`pathe` lib)
- [ ] JSON schema validation on disk
- [ ] Batch import/export CLI

### 4.2  PostgreSQL Storage
- [ ] Schema migration file (SQL X) via `drizzle-kit`
- [ ] `pgvector` column (`embedding`)
- [ ] Transaction wrapper + unit tests in `testcontainers`
- [ ] Indices: `GIN` on tags, HNSW on embedding

### 4.3  Memory (Test) Storage
- [ ] Simple Map-based impl.

### 4.4  MDC Adapter
- [ ] `.mdc` parse → `MutablePrompt`
- [ ] Round-trip tests (mdc ⇄ json)

### 4.5  Eta Templating
- [ ] Safe-mode config (no `eval` helpers)
- [ ] Benchmark vs legacy templating

---

## 5  Composition Root (`apps/server`)

- [ ] Lightweight DI container (`tsyringe`)
- [ ] Env-driven binding (FILE | POSTGRES | MDC)
- [ ] Health-check endpoint (`/health`) returns storage + adapter status
- [ ] Graceful shutdown hooks

---

## 6  Scripts & Tooling

- [ ] Rewrite `scripts/*.js` to use `tsx` & ESM
- [ ] Remove shell-only scripts → node equivalents
- [ ] `scripts/extract-contracts.ts` for API generation
- [ ] `scripts/migrate-data.ts` file → pg

---

## 7  Configuration Examples (`examples/`)

- [ ] `.env.file-storage`
- [ ] `.env.postgres`
- [ ] `docker-compose.postgres.yml`
- [ ] `docker-compose.integration.yml` (multiple MCP servers)

---

## 8  CI/CD

- [ ] GitHub Actions matrix (Node 18 | 20 · linux/osx/windows)
- [ ] Workflows: `test`, `lint`, `build`, `publish`, `docker`
- [ ] Re-usable PostgreSQL service with `postgres:14-alpine`
- [ ] Release workflow publishes:
  - [ ] npm packages (`latest` + `next` dist-tag)
  - [ ] OCI image `ghcr.io/sparesparrow/mcp-prompts`

---

## 9  Documentation

- [ ] `docs/architecture.md` – Mermaid C4 + port diagrams
- [ ] ADR-001 Project Rationale
- [ ] ADR-002 Storage Adapter Policy
- [ ] README rewrite with new usage examples
- [ ] Migration guide **v2 → v3**

---

## 10  Migration & Deprecation Plan

- [ ] Legacy package marked `deprecated` on npm with pointer
- [ ] Publish `@sparesparrow/mcp-prompts-legacy`
- [ ] Provide codemod to update import paths
- [ ] Announce beta period → collect feedback

---

## 11  Release Criteria

- [ ] All checkboxes above ticked
- [ ] CI green on merge commit
- [ ] e2e test suite (MCP Inspector) passing
- [ ] Security audit `npm audit --production` = 0
- [ ] Semantic version bump to **3.0.0**

---

*Last updated:*  <!-- auto-insert by `scripts/bump-todo.ts` -->
