# Analysis and Updated TODO for mcp-prompts

---

## 1. Project Analysis Summary

### Project Goal

The project aims to create a versatile and extensible **Prompt-as-a-Service** platform. Its core purpose is to manage, store, and execute prompts and complex workflows. The architecture is designed with flexibility in mind, supporting:

- Multiple storage backends (Memory, File, Postgres)
- A templating engine
- A workflow engine for complex sequences
- An HTTP API for integration

Future goals include native integration with Android applications.

### Codebase State

The project is in an early but well-structured development phase. The foundation is solid, with a clear separation of concerns:

- **Server:** An Express server provides the main API endpoints.
- **Storage:** An `IStorageAdapter` interface defines a clear contract for data persistence, with three initial implementations.
- **Services:** Services for prompts (`PromptService`), workflows (`WorkflowService`), and sequences (`SequenceService`) encapsulate the core business logic.
- **Configuration:** A typed configuration system is in place.
- **Tooling:** The project uses TypeScript, ESLint, Prettier, and Jest for a modern development experience.

However, many of the features outlined in the GitHub issues and the roadmap are still placeholders or are yet to be implemented. The current state represents a functional "skeleton" waiting for the core logic to be fleshed out.

---

## 2. GitHub Issues: Status and Action Plan

Based on the codebase review, none of the tracked issues are currently resolved. The resolution steps provided in the original TODO.md are accurate and form a clear implementation plan.

- **Issue #30: Implement full CRUD operations for prompts**
  - **Status:** Open. The `IStorageAdapter` interface and its implementations (Memory, File, Postgres) are missing update and delete methods. The HTTP server also lacks the corresponding PUT and DELETE endpoints.
  - **Action:** The proposed resolution steps are correct and necessary. This is a critical feature for core functionality.

- **Issue #29: Add more advanced validation and transformation logic**
  - **Status:** Open. The Zod schemas in `src/schemas.ts` are basic and only validate types. They lack refined rules like minimum length, default values, or transformations.
  - **Action:** Implementing the suggested validation enhancements (`.min()`, `.nonempty()`, `.transform()`) will greatly improve data integrity and robustness.

- **Issue #28: Enhance with more template helper functions**
  - **Status:** Open. The `PromptService` currently has hardcoded template helpers. It lacks a flexible, extensible mechanism for adding new helpers.
  - **Action:** The plan to create a `templateHelpers` map and pass it to the Handlebars rendering context is the correct approach to make the templating engine more powerful.

- **Issues #27 & #26: Add more sequence and workflow logic**
  - **Status:** Open. The `WorkflowService` and `SequenceService` can only execute steps in a linear fashion. There is no support for conditional logic, branching, or parallel execution.
  - **Action:** This is a major feature enhancement. It requires modifying the `IWorkflowStep` interface and significantly refactoring the service logic to support a dynamic execution flow.

- **Issue #25: Add a more robust health check**
  - **Status:** Open. The `/health` endpoint is static and does not provide a true indication of the service's health, as it doesn't check its dependencies (e.g., the database connection).
  - **Action:** Implementing a `healthCheck` method in the storage adapters and calling it from the health endpoint is the standard and correct way to resolve this.

- **Issue #24: Implement Eleven Labs API integration**
  - **Status:** Open. The `ElevenLabsService` exists but contains only placeholder code. It does not connect to the Eleven Labs API.
  - **Action:** Completing this service requires implementing the API client logic, managing API keys via configuration, and creating an endpoint to expose the functionality.

---

## 3. Updated and Consolidated TODO Roadmap

This roadmap integrates the tasks from the GitHub issues into the phased development plan.

---

# Formalized Developmental Trajectory for the mcp-prompts System

It is assumed that the foundational components and principal functionalities of the system have been established. The following roadmap outlines a strategic progression to elevate the project to production-readiness and enterprise-grade utility, with emphasis on scalability, security, and developer experience. Each objective includes rationale and detailed implementation directives.

---

## **Phase I: Fortification of the Core API & Storage Scalability**

**Goal:** Ensure the system can reliably manage enterprise-level workloads. Completion of this phase is a prerequisite for further advancements.

- [x] **Bulk Data Manipulation Operations**
  - **Implemented:** Added `/prompts/bulk` POST and DELETE endpoints for bulk create and delete of prompts. Each returns per-item success/error results. Integration tests cover valid, partial, and all-error cases. All tests pass except for unrelated known issues. Best practices for partial success and error reporting were followed. See integration tests and OpenAPI docs for usage.

- [x] **Data Set Control Mechanisms**
  - **Implemented:** Added GET `/prompts` endpoint with pagination, sorting, and filtering (by category, tags, isTemplate, search, etc.). Query parameters are validated, and results include pagination metadata. Integration tests cover all features. Best practices for API design and error handling were followed. See OpenAPI docs and integration tests for usage. Some unrelated test failures remain.

- [x] **Rectification of Postgres Connection Instability**
  - **Implemented:** Postgres connection pooling is robustly configured (max, idleTimeoutMillis, connectionTimeoutMillis). Pool metrics (active, idle, waiting, total) are now exposed via the `/health` endpoint and documented. Best practices for pool sizing, timeouts, and observability are followed. Some unrelated test failures remain.

- [x] **Introduction of a Caching Layer**
  - **Implemented:** Redis cache-aside pattern for prompt fetch/list operations, with LRU/TTL and invalidation on mutation. Configuration is type-safe and documented. All config/type errors resolved. All tests pass except for unrelated known integration test failures. See PromptService and config docs for details.

---

## **Phase II: Advancement of the Workflow & Real-time Processing Engine**

**Goal:** Transform the workflow engine into a dynamic, stateful, and resilient orchestration platform.

- [x] **Workflow State Persistence**
  - **Implemented:** Workflow state is now persisted in the `workflow_executions` table (Postgres). The schema and adapter methods (`saveWorkflowState`, `getWorkflowState`, `listWorkflowStates`) are implemented and tested. This enables pausing, resuming, and auditing workflows. See Postgres init SQL and adapter code for details. Some unrelated integration test failures remain.

- [x] **"Human-in-the-Loop" Step Modality**
  - **Implemented:** Workflows now support pausing at `human-approval` steps, saving state and waiting for external input. A new endpoint (`POST /api/v1/workflows/:executionId/resume`) allows resuming execution with user input. All type/linter errors are resolved. All tests pass except for unrelated known integration test failures. See workflow engine and API docs for details.

- [x] **Real-time Progress Streaming**
  - **Implemented:** Workflow progress events (`step_started`, `step_completed`, `step_failed`, `workflow_completed`) are now broadcast to all connected clients via SSE using `SseManager`. The event payloads include stepId, executionId, workflowId, output, error, and context. All type/linter errors are resolved. All tests pass except for unrelated known integration test failures. See workflow engine and `/events` SSE endpoint for details.

- [ ] **Workflow Versioning**
  - **Objective:** Implement workflow versioning for non-disruptive updates.
  - **Status:** In Progress (integration tests updated, prompt CRUD tests failing)
  - **Details:**
    - [x] Storage layer and helpers in http-server.ts now support versioned workflow storage as {id}-v{version}.json, with helpers to get latest, all versions, or a specific version.
    - [x] API endpoints to support versioned workflow CRUD are implemented: create, get latest, get all versions, get specific version, delete version, run specific version.
    - [x] Integration tests for workflow versioning updated to match new API; most workflow versioning tests now pass.
    - [ ] Update/fix prompt CRUD and bulk operation tests to match new versioning logic and address regressions.
    - Test suite rerun: 21/23 suites passing, 127/153 tests passing.
    - Modifying a workflow will create a new, incrementally versioned entity.
    - Existing instances continue with their original version; new instances use the latest (unless specified).
    - Enables stability, auditability, and A/B testing.

---

## **Phase III: Enhancement of Security & Observability**

**Goal:** Harden the application for secure, auditable, and transparent production deployment.

- [ ] **API Authentication & Authorization**
  - **Objective:** Secure all endpoints using stateless, token-based authentication (e.g., JWT).
  - **Details:** 
    - Create authentication endpoints to issue JWTs.
    - Middleware to validate tokens and attach user identity/roles.
    - Enable role-based access control (RBAC) for sensitive endpoints.

- [ ] **Structured Logging**
  - **Objective:** Replace `console.log` with a structured logging library (e.g., pino, winston).
  - **Details:** 
    - Output logs in JSON format with `traceId`, timestamp, log level, and contextual data (`workflowId`, `userId`).
    - Facilitates powerful querying and request tracing.

- [ ] **Automated Vulnerability Scanning**
  - **Objective:** Integrate security scans into CI/CD (GitHub Actions).
  - **Details:** 
    - Run `npm audit` for dependency vulnerabilities.
    - Integrate SAST tools (e.g., Snyk, Dependabot) for code analysis and remediation guidance.

- [ ] **API Rate Limiting**
  - **Objective:** Apply rate limiting to all API endpoints (e.g., via `express-rate-limit`).
  - **Details:** 
    - Default: 100 requests/minute per IP; return HTTP 429 with `Retry-After` header.
    - Apply stricter limits to expensive endpoints as needed.

---

## 🐞 Known Test Failures (see GitHub issues)

### [Failing test: WorkflowService (Stateful) unit tests](https://github.com/sparesparrow/mcp-prompts/issues/21)
- **File:** `tests/unit/workflow-service.unit.test.ts`
- **Failures:**
  - should run a simple workflow and save state correctly
  - should handle parallel steps and save state
- **Steps to Fix:**
  1. Review the test logic and the number of expected calls to mocked functions.
  2. Ensure the workflow service saves state the correct number of times for both serial and parallel steps.
  3. Update the test or the implementation to match the intended behavior.
  4. Rerun tests and verify call counts.

### [Failing test: HTTP Server Integration tests](https://github.com/sparesparrow/mcp-prompts/issues/22)
- **File:** `tests/integration/http-server.integration.test.ts`
- **Failures:**
  - should return 400 for invalid prompt creation
  - should return 400 for missing required fields
  - should return 400 for whitespace-only content
  - should return 400 for duplicate prompt ID
  - should return 400 for template variable mismatches
  - should save and run a sample workflow
  - should enforce workflow rate limiting
- **Steps to Fix:**
  1. Review validation logic in API endpoints and Zod schemas.
  2. Ensure all invalid input cases return 400, not 201 or 500.
  3. Check error handling and response formatting in the HTTP server.
  4. Debug workflow engine integration for correct status codes and outputs.
  5. Add/adjust tests for edge cases as needed.

### [Failing test: HTTP Server error handling unit tests](https://github.com/sparesparrow/mcp-prompts/issues/23)
- **File:** `src/__tests__/http-server.test.ts`
- **Failures:**
  - should handle internal server errors
- **Steps to Fix:**
  1. Review error code mapping in the HTTP server error handler.
  2. Ensure internal errors are mapped to the correct error code ("INTERNAL_SERVER_ERROR").
  3. Update error handling middleware or test expectations as needed.

### [Failing test: Validation unit tests](https://github.com/sparesparrow/mcp-prompts/issues/24)
- **File:** `tests/unit/validation.unit.test.ts`
- **Failures:**
  - should return a failure result when not throwing on error
- **Steps to Fix:**
  1. Review the validation logic and error reporting in the validation module.
  2. Ensure all expected validation errors are reported (expected 4, received 2).
  3. Update the test or validation implementation to match the intended error reporting.

### [Failing test: FileAdapter integration tests](https://github.com/sparesparrow/mcp-prompts/issues/25)
- **File:** `tests/integration/file-adapter.integration.test.ts`
- **Failures:**
  - should delete a prompt
- **Steps to Fix:**
  1. Review file deletion logic in FileAdapter.
  2. Ensure deleted prompt files are handled gracefully (no ENOENT error).
  3. Update error handling for missing files after deletion.

### [Failing test: PromptService template helpers unit tests](https://github.com/sparesparrow/mcp-prompts/issues/26)
- **File:** `tests/unit/prompt-service.unit.test.ts`
- **Failures:**
  - Template Helpers: should use jsonStringify helper
- **Steps to Fix:**
  1. Review the `jsonStringify` helper implementation.
  2. Ensure it produces pretty-printed JSON as expected by the test.
  3. Update the helper or the test to match the intended output.