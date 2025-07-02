# Changelog


### npmjs published packages tested in Docker and local environment

#### Recommended Versions:
- "@sparesparrow/mcp-prompts@1.2.48" (Recommended for Docker)
  - Most stable version
  - Successfully connects to memory storage
  - Starts HTTP server on port 3003
  - Works reliably in both Docker and local environments

#### Other Tested Versions:
- "@sparesparrow/mcp-prompts@3.0.5"
  - Starts successfully locally
  - May have dependency issues in Docker
- "@sparesparrow/mcp-prompts@1.2.8"
  - Starts with warning about HTTP transport
  - Shows as "MCP Prompts Server v3.0.0-alpha.0"

#### Versions with Issues:
- "@sparesparrow/mcp-prompts@3.0.3-main" through "@sparesparrow/mcp-prompts@3.0.1"
  - Dynamic require errors
  - Module resolution problems
- "@sparesparrow/mcp-prompts@1.8.1" through "@sparesparrow/mcp-prompts@1.2.44"
  - Various dependency and compatibility issues
  - Not recommended for production use

### Dockerhub published images
- 

All notable changes to this project will be documented in this file.

## [1.8.0] - 2025-06-21

### Added

- **Stateful Workflows**: The workflow engine is now stateful, saving execution state after each step. This allows for long-running workflows to be paused and resumed.
- **Parallel Step Execution**: Workflows now support a `parallel` step type, allowing multiple sub-steps to be executed concurrently for improved performance.
- **Android Native Service (Rust)**: Implemented a high-performance native service in Rust for the Android application, handling API communication asynchronously.
- **JNI Bindings for Android**: Completed the JNI bindings to allow the Android app to call the new native Rust service.
- **Workflow Templates**: Added new workflow templates for `code-review-summary` and `issue-triage`.
- **Comprehensive User Guide**: Created a new `USER_GUIDE.md` with a step-by-step tutorial for new users.
- **Android Integration Guide**: Added `docs/android-integration.md` to explain how to integrate the native SDK.
- **TypeDoc Generation**: Added `typedoc` and a `docs:generate` script to automatically generate API documentation from source code.

### Changed

- **Refactored `WorkflowService`**: The `WorkflowService` was significantly refactored to support stateful execution and dependency injection.
- **Improved `CONTRIBUTING.md`**: The contributing guide was expanded with detailed instructions for setting up the development environment, running tests, and submitting pull requests.

## [0.7.0] - 2025-03-15

### Added

- Server-Sent Events (SSE) support for real-time updates
- New Docker Compose configuration for running with SSE support
- Script to configure Claude desktop to use MCP-Prompts with SSE support
- Script to build and push Docker images with improved error handling
- New environment variables: ENABLE_SSE, SSE_PATH, and CORS_ORIGIN
- Mermaid diagrams in README.md for visualizing multi-server integrations
- New advanced template-based prompts:
  - `advanced-multi-server-template.json`: Coordinates multiple MCP servers for complex tasks
  - `advanced-prompt-engineering.json`: Comprehensive guide to effective prompt engineering
  - `mcp-resources-integration.json`: Guide to working with the resources/list method
- Enhanced documentation for MCP Resources integration
- Updated multi-server integration documentation

### Changed

- Enhanced HTTP server implementation with SSE functionality
- Updated ServerConfig interface to include SSE-related properties
- Improved Docker Compose file to include both standard and SSE services
- Reorganized README.md with more detailed integration diagrams
- Updated prompt format documentation with resources integration
