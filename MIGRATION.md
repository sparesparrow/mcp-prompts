# Project Migration: From Monorepo to Multi-Repo

This document outlines the migration of the MCP Prompts project from a single monorepo to a federated, multi-repository architecture.

## 1. Why Are We Migrating?

The goal is to evolve MCP Prompts from a product into a platform-centric ecosystem. This change will:
- **Improve Modularity:** Decouple data (prompts), API contracts, and implementations.
- **Enable Independent Development:** Allow different parts of the project (e.g., TypeScript server, Rust service, Prompt Collection) to be developed, versioned, and released independently.
- **Clarify Project Structure:** Make the project easier to navigate and contribute to.
- **Serve as a Reference:** Provide a clear reference implementation of the Model Context Protocol (MCP).

## 2. The New Architecture

The new architecture consists of several specialized repositories orchestrated by a central meta-repository.

- **`mcp-prompts-meta`**: The central hub for the project. It will contain high-level documentation, roadmap, contribution guides, and shared CI/CD workflows.
- **`mcp-prompts-contracts`**: A language-agnostic repository for API and data structure definitions (using Zod schemas and OpenAPI). This will be published as an NPM package.
- **`mcp-prompts-catalog`**: A versioned repository for the prompt collection and catalog. This will be published as both an NPM package and a Cargo crate.
- **`mcp-prompts-ts`**: The primary TypeScript server implementation.
- **`mcp-prompts-rs`**: The native Rust implementation (used by the Android app).
- **`mcp-prompts-pg`**: A dedicated repository for the PostgreSQL storage adapter, including `pgvector` integration.
- **`mcp-prompts-aidl`**: The Android application, which will consume the `mcp-prompts-rs` service.
- **`mcp-prompts-e2e`**: A repository for end-to-end tests that validate workflows across the entire ecosystem.

## 3. The Migration Process

The migration is divided into several phases:

1.  **Phase 0: Preparation:** Stabilize the monorepo, complete critical features, and prepare extraction scripts.
2.  **Phase 1: Foundational Repositories:** Create the `mcp-prompts-contracts` and `mcp-prompts-catalog` repositories.
3.  **Phase 2: Core Implementations:** Migrate the TypeScript (`mcp-prompts-ts`) and Rust (`mcp-prompts-rs`) implementations.
4.  **Phase 3: Specialized Implementations:** Migrate the PostgreSQL (`mcp-prompts-pg`) and Android (`mcp-prompts-aidl`) components.
5.  **Phase 4: Orchestration:** Set up the `mcp-prompts-meta` and `mcp-prompts-e2e` repositories to manage the ecosystem.
6.  **Phase 5: Finalization:** Execute the migration, update dependencies, and archive the original monorepo.

## 4. Impact on Developers & Contributors

- **Branching Strategy:** The `main` branch of the original repository will be preserved. The migration work is happening on the `feature/migration-preparation` branch.
- **New Repositories:** All future development will happen in the new, specialized repositories. Links will be provided in the main `README.md`.
- **Dependencies:** Implementations will now consume versioned packages for contracts and the prompt collection instead of using local files.

We believe this transition will make the MCP Prompts project more robust, scalable, and easier to contribute to. Thank you for your support during this process. 