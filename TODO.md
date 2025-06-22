# MCP Prompts: Multi-Repository Migration & Roadmap

This document serves as the master plan for the strategic migration of the MCP Prompts server from a monorepo to a federated, multi-repository ecosystem. It synthesizes the project's strategic analysis, architectural designs, and phased implementation plans into a single, actionable roadmap.

---

## 🎯 Strategic Vision & Principles

- **Goal:** Evolve from a monolithic product into a modular, platform-centric ecosystem that serves as a reference implementation for the Model Context Protocol (MCP).
- **Core Principle:** Separate concerns by decoupling data (prompts), contracts (API definitions), and implementations (language-specific servers).
- **Architecture:** A federated model with a central meta-repository for orchestration, a versioned repository for the prompt collection, a language-agnostic repository for API contracts, and independent repositories for each implementation (TypeScript, Rust, PostgreSQL, Android).

---

##  migration-plan: Migration Plan

### Phase 0: Pre-Migration & Stabilization

**Objective:** Complete core features, fix all critical bugs, stabilize the current monorepo, and prepare for a safe extraction process. These tasks must be completed *before* starting the repository split.

#### 1. Core Feature Completion (High Priority)

##### Enhanced File Adapter (Storage)
- [x] **Schema Validation (High):** Strictly validate all JSON files on read/write to prevent data corruption.
- [ ] **Concurrency Control (High):** Implement file locking to prevent race conditions during write operations.
- [ ] **Indexing (Medium):** Create a metadata index file to speed up list operations for large prompt collections.
- [ ] **Atomic Writes (Low):** Use a "write-then-rename" pattern for safe, atomic updates.

##### Advanced Templating Engine
- [ ] **Conditional Logic (High):** Support `if/else` constructs within templates for dynamic content generation.
- [ ] **Loops (Medium):** Support iteration over arrays (`#each`) to dynamically generate content.
- [ ] **Nested Templates / Partials (Medium):** Allow templates to include other templates to promote reuse.
- [ ] **Configurable Delimiters (Low):** Allow users to specify variable delimiters (e.g., `{{var}}`, `${var}`).
- [ ] **Variable Extraction (Low):** Implement a server-side function to automatically extract all variables from a template.
- [ ] **Helper Functions (Low):** Create a library of built-in helper functions (e.g., `toUpperCase`, `formatDate`).

#### 2. Bug Fixes & Stabilization
- [x] **Fix HTTP Server Integration tests** (`tests/integration/http-server.integration.test.ts`)
- [x] **Fix WorkflowService (Stateful) unit tests** (`tests/unit/workflow-service.unit.test.ts`)
- [ ] **Fix HTTP Server error handling unit tests** (`src/__tests__/http-server.test.ts`)
- [x] **Fix Validation unit tests** (`tests/unit/validation.unit.test.ts`)
- [x] **Fix FileAdapter integration tests** (`tests/integration/file-adapter.integration.test.ts`)
- [ ] **Fix PromptService template helpers unit tests** (`tests/unit/prompt-service.unit.test.ts`) - **BLOCKED**: The `edit_file` tool is unable to correct a simple import error in the test file, preventing tests from running.

#### 3. Migration Preparation
- [x] **Simulate Repository Structure:** Create local directories to mirror the target multi-repo architecture before performing the full migration.
    - [x] Create directories: `mcp-prompts-ts`, `mcp-prompts-rs`, `mcp-prompts-aidl`, `mcp-prompts-collection`, `mcp-prompts-py`, `mcp-prompts-contracts`.
    - [x] Add placeholder `README.md` files to each directory to define its purpose.
- [ ] **Security audit and cleanup:** Run `npm audit fix --force` and `cargo audit` and remove any secrets from git history.
- [ ] **Prepare extraction scripts:**
    - [ ] Create `scripts/extract-collection.sh` for prompt data.
    - [ ] Create `scripts/extract-contracts.sh` for type definitions.
    - [ ] Create `scripts/extract-implementations.sh` for each language.
    - [ ] Add verification scripts to ensure history is preserved using `git-filter-repo`.
- [ ] **Create final monorepo tag and documentation:**
    - [ ] Add tag `monorepo-final-v1.8.0` with comprehensive release notes.
    - [ ] Update `README.md` with a migration notice and links to the new meta-repository.
    - [ ] Create `MIGRATION.md` explaining the transition in detail.

---

### Phase 1: Foundational Repositories

**Objective:** Establish the core, shared components of the ecosystem. These repositories are dependencies for all other implementations.

#### Repository: `mcp-prompts-contracts`
- [ ] **Initialize repository:** Move API and data structure definitions into `mcp-prompts-contracts/`.
    - [ ] Move `src/interfaces.ts` to `mcp-prompts-contracts/src/interfaces.ts`.
    - [ ] Move `src/schemas.ts` to `mcp-prompts-contracts/src/schemas.ts`.
- [ ] **Establish Zod as Single Source of Truth:** Convert all type definitions to Zod schemas.
- [ ] **Set up OpenAPI Generation:** Configure automatic generation of an OpenAPI specification from the Zod schemas.
- [ ] **CI/CD Pipeline:**
    - [ ] Implement lint, test, and build pipeline.
    - [ ] Add automatic schema validation against examples.
    - [ ] Configure automatic NPM package publishing (`@sparesparrow/mcp-prompts-contracts`) on tag.
    - [ ] Trigger a `repository_dispatch` event to the meta-repo on release.

#### Repository: `mcp-prompts-collection`
- [ ] **Initialize repository:** Move all prompt and catalog data into `mcp-prompts-collection/`.
    - [ ] Move the entire `prompts/` directory to `mcp-prompts-collection/prompts/`.
    - [ ] Move the entire `packages/mcp-prompts-catalog/` directory to `mcp-prompts-collection/catalog/`.
- [ ] **CI/CD Pipeline:**
    - [ ] Add a pipeline to validate all prompts against the JSON schema from `mcp-prompts-contracts`.
    - [ ] Set up multi-format package publishing (NPM `@sparesparrow/mcp-prompts-collection`, Crates.io `mcp-prompts-collection`).
    - [ ] Implement automated prompt quality checks (e.g., checking for placeholders).
    - [ ] Configure versioning based on data changes.

---

### Phase 2: Core Implementations

**Objective:** Migrate the primary TypeScript and Rust implementations, making them consume the new foundational packages.

#### Repository: `mcp-prompts-ts`
- [ ] **Initialize repository:** Move the core TypeScript application source code and configuration into `mcp-prompts-ts/`.
    - [ ] Move `src/`, `tests/`, `scripts/`, `data/`, and `docker/` directories.
    - [ ] Move root configuration files (`package.json`, `package-lock.json`, `tsconfig.json`, `jest.config.js`, `eslint.config.js`, etc.).
- [ ] **Refactor and Cleanup:** Remove all non-TypeScript code (e.g., `android_app/`) and directories extracted in Phase 1.
- [ ] **Update Dependencies:** Replace local workspace dependencies with versioned NPM packages for `@sparesparrow/mcp-prompts-contracts` and `@sparesparrow/mcp-prompts-collection`.
- [ ] **CI/CD Pipeline:**
    - [ ] Implement a comprehensive test suite (unit, integration).
    - [ ] Set up Docker image building and publishing to Docker Hub/GHCR.
    - [ ] Configure automatic NPM package publishing (`@sparesparrow/mcp-prompts`).
    - [ ] Add a step to dispatch an event to the meta-repo on release.

#### Repository: `mcp-prompts-rs`
- [ ] **Initialize repository:** Move the Rust native service implementation into `mcp-prompts-rs/`.
    - [ ] Move the contents of `android_app/android/mcp_native_service/` to `mcp-prompts-rs/`.
- [ ] **Update Dependencies:** Add `mcp-prompts-collection` as a Cargo dependency.
- [ ] **CI/CD Pipeline:**
    - [ ] Configure a Cargo build and test pipeline, including `clippy` and `rustfmt` checks.
    - [ ] Set up crates.io publishing (`mcp-prompts-rs`).
    - [ ] Configure Docker image building and publishing.
    - [ ] Add a step to dispatch an event to the meta-repo on release.

---

### Phase 3: Specialized Implementations

**Objective:** Migrate the more complex, platform-specific implementations.

#### Repository: `mcp-prompts-pg`
- [ ] **Initialize repository:** Extract PostgreSQL-specific code (`PostgresAdapter`, `docker/postgres/init/`, etc.) into a new repository.
- [ ] **Design dedicated schema:** Formalize the `prompts.schema` with versioning and audit logging capabilities.
- [ ] **Implement pgvector integration:** Add full support for semantic search using embeddings.
- [ ] **CI/CD Pipeline:**
    - [ ] Add `sqlfluff` for SQL linting.
    - [ ] Implement database migration testing.
    - [ ] Set up Docker image publishing with init scripts.
    - [ ] Add performance benchmarks (target: <=100ms for 1M vectors).
    - [ ] Configure Helm chart publishing.

#### Repository: `mcp-prompts-aidl`
- [ ] **Initialize repository:** Move the Android application source code into `mcp-prompts-aidl/`.
    - [ ] Move the contents of `android_app/` (excluding the native Rust service) into `mcp-prompts-aidl/`.
- [ ] **Embed Rust micro-service:** Integrate `mcp-prompts-rs` as the core engine.
- [ ] **Develop Tasker integration:** Create profiles for integration with the Android automation app Tasker.
- [ ] **CI/CD Pipeline:**
    - [ ] Configure a Gradle/Cargo build pipeline for the AAR library and APK.
    - [ ] Set up AAR library publishing to Maven Central.
    - [ ] Configure Docker image for Android emulator testing.

---

### Phase 4: Ecosystem Orchestration & Validation

**Objective:** Tie the federated ecosystem together with central orchestration and end-to-end testing.

#### Repository: `mcp-prompts-meta`
- [ ] **Initialize repository:** Create a new repository to serve as the project's central hub.
- [ ] **Populate with documentation:** Move high-level architecture docs, roadmap, and contributing guides here.
- [ ] **Implement reusable workflows:** Create shared GitHub Actions workflows (`workflow_call`) for common tasks like linting, building, and publishing.
- [ ] **Implement orchestration logic:**
    - [ ] Create a `repository_dispatch` handler to listen for releases from other repos.
    - [ ] Automate the building of a "suite" Docker image containing all server implementations.
    - [ ] Automate the generation of a compatibility matrix.
    - [ ] Automate the creation of consolidated release notes.

#### Repository: `mcp-prompts-e2e`
- [ ] **Initialize repository:** Create a new repository for end-to-end tests.
- [ ] **Develop multi-server test suite:** Create tests that validate workflows across multiple server implementations running together.
- [ ] **Create docker-compose environments:** Define test environments that spin up various combinations of the servers.
- [ ] **CI/CD Pipeline:**
    - [ ] Configure automated execution of the E2E suite.
    - [ ] Set up scheduled nightly runs.
    - [ ] Implement comprehensive test reporting and metrics.

---

### Phase 5: Migration Execution & Archival

**Objective:** Finalize the transition and formally archive the original monorepo.

- [ ] **Execute repository migration:** Run all extraction scripts, verify history, and set up new repositories on GitHub.
- [ ] **Update all cross-repository dependencies** to point to the new versioned packages.
- [ ] **Test the complete multi-repo workflow** from a code change in one repo to a final orchestrated release.
- [ ] **Archive the original monorepo:**
    - [ ] Mark the `mcp-prompts-ts` repository (the renamed monorepo) as the official TypeScript implementation.
    - [ ] Update its README to reflect its new, focused role.
    - [ ] Make the now-empty `sparesparrow/mcp-prompts` the new meta-repository.
    - [ ] Add deprecation notices to old NPM packages if necessary.

---

## backlog: Future Vision & Advanced Features (Post-Migration)

This section contains features to be implemented after the core migration is complete.

### Advanced Templating Engine
- [ ] **Conditional Logic:** Support `if/else` constructs within templates.
- [ ] **Loops:** Support iteration over arrays to dynamically generate content.
- [ ] **Configurable Delimiters:** Allow users to specify variable delimiters (e.g., `{{var}}`, `${var}`).
- [ ] **Nested Templates (Partials):** Allow templates to include other templates.
- [ ] **Variable Extraction:** Implement a server-side function to automatically extract all variables from a template.

### Enhanced File Adapter
- [ ] **Schema Validation:** Strictly validate all JSON files on read/write.
- [ ] **Concurrency Control:** Implement file locking to prevent race conditions.
- [ ] **Indexing:** Create a metadata index file to speed up list operations.
- [ ] **Atomic Writes:** Use a "write-then-rename" pattern for safe updates.

### Enterprise & Ecosystem Features
- [ ] **Python Implementation:** Create a Python port (`mcp-prompts-py`).
- [ ] **Advanced RBAC:** Implement fine-grained, role-based access control.
- [ ] **Enterprise Audit Logging:** Standardize audit logs across all implementations.
- [ ] **Resource URI System:** Implement a full Resource URI parser and router for deep ecosystem integration (`@github:`, `@filesystem:`, etc.).
- [ ] **Bidirectional GitHub Sync:** Allow for a full Git-based workflow for managing prompts.