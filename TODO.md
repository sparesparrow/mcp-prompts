# TODO – Hexagonal Refactor of **mcp-prompts**

> **Scope**  This checklist tracks every task needed to migrate the existing
> *mcp-prompts* repository to a clean Ports & Adapters (Hexagonal)
> architecture, publish the new multi-package workspace, and deprecate the
> legacy code-path.  Each task MUST be checked off before the **v3.0.0**
> release tag is cut.

---

## 0  Project-wide Conventions

- [x] Source language = TypeScript 5.5 · `strict` mode enforced
- [x] Package manager = pnpm v9 workspaces
- [x] Code style = ESLint + Prettier (Airbnb base) – CI-guarded
- [x] Unit tests = Vitest · 90 % line coverage threshold
- [x] e2e tests = Playwright (HTTP) + MCP Inspector scripts (stdio)
- [x] Conventional Commits + changesets for automated release notes

---

## 1  Repository Re-structure

| Path | Purpose | Status |
| ---- | ------- | ------ |
| `packages/core` | Domain entities, DTOs, ports, use-cases | [x] ✅ COMPLETED |
| `packages/adapters-file` | `IPromptRepository` file impl. | [ ] |
| `packages/adapters-postgres` | Postgres impl. inc. pgvector | [ ] |
| `packages/adapters-memory` | In-mem mock (tests) | [ ] |
| `packages/adapters-mdc` | Cursor Rules MDC parser | [ ] |
| `packages/adapters-eta` | `ITemplatingEngine` (Eta) | [ ] |
| `packages/adapters-mcp` | Driving MCP server | [ ] |
| `packages/adapters-rest` | Driving REST (Express) | [ ] |
| `packages/adapters-cli` | Driving CLI (Commander) | [ ] |
| `apps/server` | Composition root + DI | [ ] |
| `docs` | Architecture, ADRs, diagrams | [x] ✅ COMPLETED |

- [x] Monorepo bootstrapped with `pnpm init` and `pnpm workspaces`
- [x] Root `tsconfig.json` with references to each package
- [x] Path aliases (`@core/*`, `@adapters/*`)

---

## 2  Domain Modelling (`packages/core`) ✅ COMPLETED

### 2.1  Entities ✅ COMPLETED
- [x] `Prompt` - Core prompt entity with validation
- [x] `TemplateVariable` - Template variable entity
- [x] `Category` - Category entity for organization
- [x] `User` - User entity for authentication

### 2.2  Value Objects & Utilities ✅ COMPLETED
- [x] `PromptId` (UUID v7) - Immutable identifier with validation
- [x] `Tag` (string regex) - Validated tags with sanitization
- [x] `TemplateVariable` - Immutable template variable representation

### 2.3  Ports (Interfaces) ✅ COMPLETED
- [x] **Primary** `IPromptApplication` - Application service interface
- [x] **Secondary** `IPromptRepository` - Storage abstraction
- [x] **Secondary** `ITemplatingEngine` - Template processing interface
- [x] **Secondary** `IEventPublisher` - Event publishing interface
- [x] **Secondary** `ISecurityValidator` - Security validation interface

### 2.4  Use-cases (Services) ✅ COMPLETED
- [x] `addPrompt` - Add new prompt with validation
- [x] `getPromptById` - Get prompt by ID and version
- [x] `listPrompts` - List prompts with filtering and pagination
- [x] `updatePrompt` - Update existing prompt
- [x] `deletePrompt` - Delete prompt or specific version
- [x] `applyTemplate` - Apply template variables
- [x] `validatePrompt` - Comprehensive prompt validation
- [x] `searchPrompts` - Text-based prompt search
- [x] `getPromptStats` - System statistics and analytics

> All use-cases = ✅
>  • pure functions  ✅ • no `console`  ✅ • 0 external imports outside ports ✅

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

## 9  Documentation ✅ COMPLETED

- [x] `docs/architecture.md` – Mermaid C4 + port diagrams ✅
- [x] ADR-001 Project Rationale ✅
- [ ] ADR-002 Storage Adapter Policy
- [x] README rewrite with new usage examples ✅
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

## 🎯 **PHASE 1 COMPLETED** ✅

<<<<<<< Updated upstream
**Core Domain Layer Successfully Implemented:**
- ✅ All domain entities created with Zod validation
- ✅ Value objects implemented with immutability
- ✅ Port interfaces defined and documented
- ✅ Use cases implemented with business logic
- ✅ Comprehensive validation and error handling
- ✅ Architecture documentation with Mermaid diagrams
- ✅ ADR-001 documenting architectural decisions

**Next Phase: Adapter Implementation**
- Focus on storage adapters (File, PostgreSQL, Memory, MDC)
- Implement driving adapters (MCP, REST, CLI)
- Integration testing and validation

---

*Last updated:* 2025-01-27
*Phase 1 Status:* ✅ COMPLETED
*Overall Progress:* 25% (Core domain layer complete)
=======
- [x] FileAdapter: atomic writes, file locking, schema validation, index, robustness tests
- [x] Restore and fix skipped/legacy core tests (sse, http-server, addPrompt)
>>>>>>> Stashed changes
