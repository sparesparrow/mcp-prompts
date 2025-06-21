TODOs for mcp-prompts

---

### Issue #30: [TODO] Implement full CRUD operations for prompts

**File:** `src/adapters.ts:168`  
**Goal:** The existing storage adapters are missing `update` and `delete` functionality. This task is to implement these methods for all adapters to ensure full Create, Read, Update, Delete (CRUD) support.

**Resolution Steps:**

1.  **Modify `IStorageAdapter` Interface:**
    * Open `src/interfaces.ts`.
    * Add the following method signatures to the `IStorageAdapter` interface:
        ```typescript
        update(id: string, data: Partial<Prompt>): Promise<Prompt | null>;
        delete(id: string): Promise<boolean>;
        ```

2.  **Implement in `MemoryStorageAdapter`:**
    * Open `src/adapters.ts`.
    * In the `MemoryStorageAdapter` class, add the `update` method. It should find the prompt by `id` in the `this.prompts` map, merge the new data, and return the updated prompt.
    * Add the `delete` method. It should remove the prompt by `id` from the `this.prompts` map using `this.prompts.delete(id)` and return `true` if successful.

3.  **Implement in `FileStorageAdapter`:**
    * In the `FileStorageAdapter` class, add the `update` and `delete` methods.
    * These methods will need to read the entire JSON file, modify the in-memory array of prompts (update or remove an item), and then write the entire array back to the file.
    * Ensure file operations are atomic to prevent data corruption.

4.  **Implement in `PostgresStorageAdapter`:**
    * In the `PostgresStorageAdapter` class, add the `update` method. It should execute a SQL `UPDATE` query to modify the specified prompt in the `prompts` table.
    * Add the `delete` method. It should execute a SQL `DELETE` query to remove the prompt from the `prompts` table.

5.  **Add API Endpoints:**
    * Open `src/http-server.ts`.
    * Create a `PUT /prompts/:id` endpoint that calls `storageAdapter.update(id, req.body)`.
    * Create a `DELETE /prompts/:id` endpoint that calls `storageAdapter.delete(id)`.

6.  **Write Integration Tests:**
    * In the `tests/integration/` directory, update the tests for each adapter (`memory-adapter.integration.test.ts`, etc.) to verify the new `update` and `delete` functionalities work as expected.

---

### Issue #29: [TODO] Add more advanced validation and transformation logic

**File:** `src/schemas.ts:25`  
**Goal:** Enhance the Zod schemas to include more specific validation rules and data transformations.

**Resolution Steps:**

1.  **Refine `promptSchema`:**
    * Open `src/schemas.ts`.
    * Add more specific validation to `promptSchema`. For example:
        * Use `.min(1)` for the `name` and `content` fields to ensure they are not empty.
        * Use `.default(new Date())` for the `createdAt` field.
        * Add a `.transform()` to sanitize or format data, such as trimming whitespace from the `name`.

2.  **Refine `workflowSchema`:**
    * Apply similar enhancements to `workflowSchema`.
    * Ensure that the `steps` array is not empty using `.nonempty()`.
    * Add validation for each field within the workflow step objects.

3.  **Implement Custom Validation:**
    * Use `.superRefine()` for complex validation rules. For example, ensure that if a prompt is a template (`isTemplate: true`), its content must include template placeholders like `{{variable}}`.

4.  **Update API Usage:**
    * In `src/http-server.ts`, ensure you are using the `safeParse` method from the Zod schemas to handle validation errors gracefully in all relevant endpoints (`POST /prompts`, `POST /workflows`).

---

### Issue #28: [TODO] Enhance with more template helper functions

**File:** `src/prompt-service.ts:33`  
**Goal:** Expand the templating engine's capabilities by adding more built-in helper functions.

**Resolution Steps:**

1.  **Define a Helper Function Map:**
    * In `src/prompt-service.ts`, create a map or object to store the helper functions.
        ```typescript
        const templateHelpers: { [key: string]: Function } = {
          toUpperCase: (str: string) => str.toUpperCase(),
          toLowerCase: (str: string) => str.toLowerCase(),
          jsonStringify: (obj: any) => JSON.stringify(obj, null, 2),
          // Add more helpers here
        };
        ```

2.  **Modify `render` function:**
    * Update the `render` function to pass this `templateHelpers` map to the context of the template rendering engine (e.g., Handlebars, Lodash template). This will make the functions available within the templates.

3.  **Update Unit Tests:**
    * In `tests/unit/prompt-service.unit.test.ts`, add new tests to verify that each helper function works correctly when used within a prompt template.

4.  **Document New Functions:**
    * Update `docs/05-templates-guide.md` to include a section listing all available helper functions with examples of their usage.

---

### Issues #27 and #26: Add more sequence and workflow logic

**Files:** `src/sequence-service.ts:20`, `src/workflow-service.ts:22`  
**Goal:** Make the sequence and workflow engines more powerful by adding features like conditional logic, loops, and parallel execution.

**Resolution Steps:**

1.  **Update Interfaces:**
    * In `src/interfaces.ts`, modify `IWorkflowStep` and `ISequenceStep`.
    * Add optional properties like `condition` (a string to be evaluated), `onSuccess` (next step ID on success), `onFailure` (next step ID on failure), and `type` (e.g., 'serial', 'parallel').

2.  **Enhance `WorkflowService`:**
    * In `src/workflow-service.ts`, refactor the `run` method.
    * Before executing a step, evaluate its `condition` property against the current workflow context/state.
    * Based on the result, dynamically determine the next step to execute using the `onSuccess` or `onFailure` properties.
    * Implement logic to handle steps of `type: 'parallel'` by executing them concurrently using `Promise.all`.

3.  **Enhance `SequenceService`:**
    * Apply similar logic to `src/sequence-service.ts` if sequences are intended to have advanced flow control.

4.  **Add Tests and Documentation:**
    * Write new unit tests to cover conditional execution and parallel steps.
    * Update `docs/09-workflow-guide.md` with the new, advanced syntax and provide examples.

---

### Issue #25: [TODO] Add a more robust health check

**File:** `src/http-server.ts:70`  
**Goal:** The current `/health` endpoint is too basic. It should be improved to check the status of its dependencies, such as the database.

**Resolution Steps:**

1.  **Create a Health Check Service:**
    * In `src/adapters.ts`, add a `healthCheck(): Promise<boolean>` method to the `IStorageAdapter` interface.
    * Implement this method in each storage adapter.
        * For `PostgresStorageAdapter`, it should run a simple query like `SELECT 1` to verify the connection is alive.
        * For `FileStorageAdapter`, it could check if the storage file is readable and writable.
        * For `MemoryStorageAdapter`, it can simply return `Promise.resolve(true)`.

2.  **Update `/health` Endpoint:**
    * In `src/http-server.ts`, modify the `/health` endpoint handler.
    * Call the `storageAdapter.healthCheck()` method.
    * If the check passes, return a `200 OK` with a status message.
    * If the check fails, return a `503 Service Unavailable` status with details about the failure.

---

### Issue #24: [TODO] Implement Eleven Labs API integration

**File:** `src/elevenlabs-service.ts:15`  
**Goal:** To complete the integration with the Eleven Labs API for text-to-speech (TTS) functionality.

**Resolution Steps:**

1.  **Add Configuration:**
    * In `src/config.ts`, add a configuration section for the Eleven Labs API key and default voice ID. Ensure these can be set via environment variables.

2.  **Implement `generateAudio` method:**
    * In `src/elevenlabs-service.ts`, complete the `generateAudio` function.
    * Use `axios` or `node-fetch` to make a `POST` request to the Eleven Labs TTS endpoint (`https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`).
    * Pass the text and voice settings in the request body.
    * Set the `xi-api-key` header with the API key from the configuration.
    * The function should return the audio stream or buffer.

3.  **Create an API Endpoint:**
    * In `src/http-server.ts`, create a new endpoint, e.g., `POST /audio/generate`.
    * This endpoint will take text as input, call the `elevenlabsService.generateAudio` method, and stream the resulting audio back to the client with the correct `Content-Type` header (e.g., `audio/mpeg`).

4.  **Add Error Handling:**
    * Implement robust error handling for API failures (e.g., invalid API key, insufficient credits).

## Phase 1: Core Functionality & API Stabilization
### [ ] Finalize API Endpoints: Review and complete all planned endpoints in http-server.ts. Ensure consistent request/response formats for all prompt and workflow operations.
### [ ] Strengthen Input Validation: Implement comprehensive validation for all incoming data (API requests, configuration files) using Zod schemas defined in src/schemas.ts.
### [ ] Refine Error Handling: Create a centralized error handling mechanism to provide meaningful and standardized error messages across the API.
### [ ] Complete Storage Adapter Features: Ensure all storage adapters (File, Memory, Postgres) fully implement the IStorageAdapter interface and handle edge cases gracefully.
### [ ] BUG: The PostgresStorageAdapter has an intermittent connection issue under heavy load. Investigate pooling configuration and add retry logic. *(Attempted, but blocked by file editing issues)*

## Phase 2: Workflow & Sequence Engine Enhancement
### [ ] Expand Workflow Step Types: Enhance workflow-service.ts to support more complex logic, including conditional steps (if/else), parallel execution, and integration with external APIs.
### [ ] Implement State Management: Design and implement a robust state management system for long-running workflows, allowing them to be paused, resumed, and inspected.
### [ ] Develop Workflow CLI: Improve the interactive workflow-cli.ts to support creating, testing, and debugging workflows from the command line.
### [x] Create Workflow Templates: Develop a library of pre-built workflow templates for common use cases (e.g., code review summarization, issue triage).

## Phase 3: Android & Native Integration
### [ ] Define Native Service API (Rust): Finalize the function signatures and data structures in android_app/android/mcp_native_service/src/lib.rs for communication between the Kotlin app and the Rust library.
### [ ] Implement JNI Bindings: Complete the JNI bindings in MainActivity.kt and McpService.kt to call Rust functions from the Android application.
### [ ] Secure Data Transfer: Implement secure methods for passing sensitive data (like API keys) between the Android app and the native service.
### [ ] Build and Test Android App: Create a simple UI in the Android app to test fetching prompts via the native service and display the results.

## Phase 4: Testing & Quality Assurance
### [ ] Increase Unit Test Coverage: Write additional unit tests for prompt-service.ts, workflow-service.ts, and sequence-service.ts to cover more business logic and edge cases.
### [ ] Write End-to-End Integration Tests: Create comprehensive integration tests that simulate a full user flow, from creating a prompt with the API to retrieving it in the Android app.
### [ ] Automate docker-compose Testing: Expand run-docker-tests.sh to automatically test various multi-container configurations (e.g., server with PostgreSQL, server with pgai). *(Attempted, but blocked by file editing issues)*
### [ ] Performance Testing: Develop a set of performance tests to benchmark the API response times and workflow execution speed under load. *(Attempted, but server is unstable)*

## Phase 5: Documentation & Developer Experience
### [x] Generate API Reference from Code: Use a tool like typedoc to generate a complete API reference from JSDoc comments in the TypeScript source code.
### [x] Create a Comprehensive User Guide: Write a step-by-step guide for new users, covering initial setup, configuration, creating the first prompt, and running a workflow.
### [x] Document Android Integration: Create a detailed guide for mobile developers explaining how to integrate the mcp-prompts SDK into their Android applications.
### [x] Refine CONTRIBUTING.md: Update the contributing guide with clear instructions on setting up the development environment, running tests, and submitting pull requests.

## Phase 6: Deployment & Finalization
### [x] Finalize NPM Package: Ensure package.json is correctly configured for publishing the project to NPM or GitHub Packages.
### [x] Streamline Docker Hub Publication: Refine the build-and-publish.sh script and the corresponding GitHub Actions to automate the multi-arch build and publication process to Docker Hub.
### [x] Update CHANGELOG and Release: Prepare for a v1.0.0 release by finalizing the CHANGELOG.md and creating a new release tag.
### [x] Add Helm Charts: For Kubernetes users, create Helm charts to simplify the deployment of the mcp-prompts server and its dependencies.
