![MCP-Prompts Architecture Overview](images/architecture.png)

> **Quick Reference:** The following Mermaid diagram provides a text-based architecture overview. GitHub now renders Mermaid diagrams natively in Markdown for easy navigation and accessibility.

```mermaid
graph TD
  subgraph Clients
    A1[LM Studio]
    A2[LibreChat]
    A3[Tasker (Android)]
    A4[Cursor IDE]
    A5[Claude Desktop]
  end
  subgraph MCP-Prompts Server
    B1[Prompt Service]
    B2[HTTP/SSE API]
    B3[Adapter Factory]
  end
  subgraph Storage Adapters
    C1[File Adapter]
    C2[Postgres Adapter]
    C3[MDC (Cursor Rules) Adapter]
    C4[ElasticSearch Adapter]
  end
  subgraph Integrations
    D1[Docker]
    D2[GitHub Actions]
    D3[Release Automation]
  end

  A1 --> B2
  A2 --> B2
  A3 --> B2
  A4 --> B2
  A5 --> B2
  B2 --> B1
  B1 --> B3
  B3 --> C1
  B3 --> C2
  B3 --> C3
  B3 --> C4
  B2 --> D1
  D2 --> D3
  D1 --> B2
```

# MCP Prompts

A streamlined prompt manager using MCP architecture patterns.

## Features

- ✨ Prompt management with versioning and metadata
- 🔄 Template support with variable substitution
- 📦 Multiple storage adapters (File, PostgreSQL, Memory, MDC, ElasticSearch)
- 🌐 HTTP API with robust security and rate limiting
- 🔌 Server-Sent Events (SSE) for real-time updates
- 🔒 Secure by default with helmet security headers
- 🚦 Rate limiting to prevent abuse
- 🔄 Automatic reconnection for SSE clients
- 🧹 Automatic cleanup of stale connections
- 📝 Comprehensive logging and error handling

## Installation

```bash
npm install mcp-prompts
```

## Quick Start

```typescript
import { startServer } from 'mcp-prompts';

const server = await startServer({
  port: 3003,
  storageType: 'file',
  promptsDir: './prompts',
  enableSSE: true
});
```

## Configuration

The server supports various configuration options:

```typescript
interface ServerConfig {
  // Server settings
  port: number;
  host: string;
  name: string;
  version: string;

  // Storage settings
  storageType: 'file' | 'postgres' | 'memory' | 'mdc' | 'elasticsearch';
  promptsDir: string;
  backupsDir: string;

  // HTTP settings
  httpServer: boolean;
  corsOrigin?: string;
  
  // Rate limiting
  rateLimit?: {
    windowMs: number; // Default: 15 minutes
    max: number;      // Default: 100 requests per windowMs
  };

  // SSE settings
  enableSSE?: boolean;
  ssePath?: string;
  
  // PostgreSQL settings (if using postgres storage)
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };

  // ElasticSearch settings (if using elasticsearch storage)
  elasticsearch?: {
    node: string;
    auth?: {
      username: string;
      password: string;
    };
    index?: string;
    sequenceIndex?: string;
  };
}
```

## HTTP API

The server provides a RESTful HTTP API with the following endpoints:

### Prompts

- `POST /prompts` - Create a new prompt
- `GET /prompts/:id` - Get a prompt by ID
- `PUT /prompts/:id` - Update a prompt
- `DELETE /prompts/:id` - Delete a prompt
- `GET /prompts` - List all prompts

### Templates

- `POST /templates` - Create a new template
- `GET /templates/:id` - Get a template by ID
- `PUT /templates/:id` - Update a template
- `DELETE /templates/:id` - Delete a template
- `POST /templates/:id/apply` - Apply a template with variables

### Server-Sent Events

The SSE implementation provides real-time updates with:

- Automatic reconnection with exponential backoff
- Message history for missed updates
- Heartbeat to detect stale connections
- Proper cleanup of disconnected clients

To connect to the SSE stream:

```javascript
const sse = new EventSource('/events');

sse.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

sse.onerror = (error) => {
  console.error('SSE error:', error);
};
```

## Security

The server implements several security measures:

- Helmet security headers
- Rate limiting
- CORS configuration
- Request size limits
- Input validation
- Error handling

## Contributing

Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap

- [x] HTTP API with security features
- [x] SSE support with reconnection
- [x] Multiple storage adapters
- [x] Template support
- [x] ElasticSearch adapter
- [x] Orchestrator integration
- [x] Mermaid diagram server

## Support

For support, please open an issue in the GitHub repository or join our Discord community.

# MCP Prompts Server

[![Build Status](https://img.shields.io/github/actions/workflow/status/sparesparrow/mcp-prompts/ci.yml?branch=main)](https://github.com/sparesparrow/mcp-prompts/actions)
[![Coverage](https://codecov.io/gh/sparesparrow/mcp-prompts/branch/main/graph/badge.svg)](https://codecov.io/gh/sparesparrow/mcp-prompts)
[![npm](https://img.shields.io/npm/v/@sparesparrow/mcp-prompts)](https://www.npmjs.com/package/@sparesparrow/mcp-prompts)
[![License](https://img.shields.io/github/license/sparesparrow/mcp-prompts.svg)](LICENSE)
![LM Studio](https://img.shields.io/badge/Client-LM%20Studio-blue?logo=appveyor)
![LibreChat](https://img.shields.io/badge/Client-LibreChat-blue?logo=appveyor)
![Tasker](https://img.shields.io/badge/Client-Tasker-blue?logo=appveyor)
![Android](https://img.shields.io/badge/Client-Android-green?logo=android)
![Cursor IDE](https://img.shields.io/badge/Client-Cursor%20IDE-blue?logo=visualstudiocode)
![Claude Desktop](https://img.shields.io/badge/Client-Claude%20Desktop-blue?logo=anthropic)

A lightweight, extensible server for managing prompts and templates in the Model Context Protocol (MCP) ecosystem. **Store prompts once, version them, and retrieve them on demand.**

---

## Why MCP-Prompts?

* 🔌 **Pluggable storage** – file-system, PostgreSQL, MDC (Cursor Rules), and more coming.
* 🧩 **Composable** – expose prompts as MCP resources or HTTP/SSE endpoints.
* 🚀 **Instant setup** – run locally with _npx_ or in the cloud with Docker.
* 🛠️ **Dev-friendly** – JSON schema validation, typed SDK, comprehensive tests.
* 📜 **Open licence & community focused** – contributions welcome!

---

## 30-Second Quick-Start

### 1. Using npx (no dependencies)
```bash
npx -y @sparesparrow/mcp-prompts
curl http://localhost:3003/health   # → { "status": "ok" }
```

### 2. Using Docker (persistent volume)
```bash
docker run -d --name mcp-prompts \
  -p 3003:3003 \
  -e HTTP_SERVER=true \
  -e STORAGE_TYPE=file \
  -v $(pwd)/data:/app/data \
  sparesparrow/mcp-prompts:latest
```

### 3. Docker Compose (PostgreSQL + ElevenLabs)
Create a `docker-compose.yml` file:
```yaml
version: "3.8"
services:
  prompts:
    image: sparesparrow/mcp-prompts:latest
    environment:
      HTTP_SERVER: "true"
      STORAGE_TYPE: "postgres"
      POSTGRES_CONNECTION_STRING: "postgresql://postgres:password@db:5432/mcp_prompts"
      ELEVENLABS_API_KEY: "${ELEVENLABS_API_KEY}"
      ELEVENLABS_MODEL: "eleven_multilingual_v2"
      ELEVENLABS_VOICE_ID: "21m00Tcm4TlvDq8ikWAM"  # Default voice
      ELEVENLABS_STABILITY: "0.75"  # Higher stability for better quality
      ELEVENLABS_SIMILARITY: "0.85"  # Higher voice similarity
      ELEVENLABS_STYLE: "1.0"  # Maximum style injection
      ELEVENLABS_SPEAKER_BOOST: "true"  # Enable speaker boost
      ELEVENLABS_CHUNK_LENGTH: "200"  # Optimal chunk size for cost/quality
      ELEVENLABS_CACHE_DIR: "/app/cache/audio"  # Cache generated audio
    ports: [ "3003:3003" ]
    volumes:
      - audio_cache:/app/cache/audio
    depends_on: [ db ]
  db:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  audio_cache:
  postgres_data:
```
Then run:
```bash
docker compose up -d
curl http://localhost:3003/health
```

---

## Docker Images & Automated Publishing

Docker images for MCP-Prompts are automatically built and published to the GitHub Container Registry (GHCR) on every push to `main` and on every version tag (e.g., `v1.2.3`).

- **Registry:** `ghcr.io/sparesparrow/mcp-prompts`
- **Tags:** `latest`, or a specific version (e.g., `v1.2.43`)

### Pull the Latest Image
```bash
docker pull ghcr.io/sparesparrow/mcp-prompts:latest
```

### Pull a Specific Version
```bash
docker pull ghcr.io/sparesparrow/mcp-prompts:v1.2.43
```

These images are built and signed automatically by [GitHub Actions](.github/workflows/docker-publish.yml) on every release.

> **Note:** If you need Docker Hub support, open an issue or PR. The workflow can be extended to push to Docker Hub as well.

### Release Notes Automation

Release notes for every GitHub release are now **automatically generated and categorized** using [release.yml](.github/release.yml). Categories include Features, Bugfixes, Dependencies, and Other Changes. You can customize these categories by editing `.github/release.yml`.

For more details and advanced configuration, see the [GitHub Docs: Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes).

---

## Implemented vs Planned Features

| Feature | Status | Notes |
| --- | :---: | --- |
| File storage adapter | ✅ | stable |
| Memory storage adapter | ✅ | stable, for testing/dev |
| PostgreSQL adapter (+ embeddings) | ✅ | since v1.2.x |
| MDC adapter (Cursor Rules) | ✅ | stable, fully tested |
| HTTP server + SSE | ✅ | stable, with compression |
| ElasticSearch adapter | ✅ | since v1.3.x |
| Orchestrator integration | ✅ | basic workflow tool & endpoint |
| Mermaid diagram server | ✅ | basic HTTP endpoint |

Legend: ✅ stable · ⚠️ experimental · 🛠️ in progress

---

## Documentation

This README is intentionally concise. Full documentation lives in the `docs/` directory, and each key directory (`scripts/`, `docker/scripts/`, `legacy/`, `examples/`) contains a README for navigation and usage details.

> **See also:** Links to official MCP documentation and community resources are provided below.

| Path | What you will find there |
| --- | --- |
| `docs/00-overview.md` | Detailed project overview & motivation |
| `docs/01-quickstart.md` | The same quick-start plus advanced tips |
| `docs/02-configuration.md` | All environment variables & CLI flags |
| `docs/03-storage-adapters.md` | File, Postgres, MDC, and upcoming adapters |
| `docs/04-api-reference.md` | Tool & HTTP API reference (WIP) |
| `docs/05-templates-guide.md` | Variables, apply, export, best practices |
| `docs/06-mcp-integration.md` | Multi-server scenarios, router, SSE |
| `docs/07-developer-guide.md` | Contributing, tests, release process |
| `docs/08-roadmap.md` | Planned features & milestones |

> ℹ️ Legacy content from the previous long README has been preserved at `docs/LEGACY_README.md` until the migration is complete.

> **New:** See [examples/advanced-workflow-example.json](./examples/advanced-workflow-example.json) and the expanded [Templates Guide](./docs/05-templates-guide.md) for advanced prompt chaining and workflow usage.

> **Validation:** Prompts are now validated for required fields, duplicate IDs, variable consistency, and content format. See [src/prompt-service.ts](./src/prompt-service.ts) for details.
> **Testing:** The MDC (Cursor Rules) adapter is now covered by integration tests. See [tests/integration/mdc-adapter.integration.test.ts](./tests/integration/mdc-adapter.integration.test.ts).

---

## Official MCP Documentation & Community Resources

- [Model Context Protocol (MCP) – Official Docs](https://modelcontextprotocol.org/)
- [MCP GitHub Organization](https://github.com/modelcontextprotocol)
- [Cursor IDE – Model Context Protocol](https://docs.cursor.com/context/model-context-protocol)
- [MCP Community Discussions](https://github.com/orgs/community/discussions)
- [GitHub Actions Starter Workflows (for workflow inspiration)](https://github.com/actions/starter-workflows)

---

## User Guides

- [How to use MCP-Prompts with Claude Desktop, Cursor IDE, LM Studio, LibreChat, and Tasker (English)](./USER_GUIDE.md)
- [Jak používat MCP-Prompts s Claude Desktop, Cursor IDE, LM Studio, LibreChat a Taskerem (česky)](./USER_GUIDE-cs.md)

> **Note:** User guides are now fully expanded for all major clients, including step-by-step setup, troubleshooting, and quick reference checklists. See the guides above for details.

---

## Supported Clients

MCP-Prompts works with the following clients:

- **LM Studio** – [Setup Guide](#)
- **LibreChat** – [Setup Guide](#)
- **Tasker (Android)** – [Setup Guide](#)
- **Cursor IDE** – [Setup Guide](#)
- **Claude Desktop** – [Setup Guide](#)

See the [examples/](./examples/) directory for configuration snippets.

---

## How to Contribute

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines, or open an issue if you have questions or suggestions.

- Fork the repo and create a feature branch
- Run `npm install` and `npm test` to ensure all tests pass
- Submit a pull request with a clear description

---

## Community Standards

We are committed to a welcoming, inclusive, and safe community for all contributors.

- Please read our [Contributing Guide](./CONTRIBUTING.md) before opening issues or pull requests.
- All contributors and participants are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).
- Security issues should be reported privately as described in our [Security Policy](./SECURITY.md).
- We use [issue templates](./.github/ISSUE_TEMPLATE/) and a [pull request template](./.github/pull_request_template.md) to help you provide actionable, high-quality contributions.

---

## Sustainability

MCP-Prompts is committed to long-term sustainability as both a technical project and a community resource. Our approach includes:

- **Ongoing Maintenance:**
  - Regular updates, bug fixes, and compatibility with new MCP standards and client versions.
  - Maintenance costs are minimized through automation and community contributions.

- **Community Engagement:**
  - Open to contributors of all backgrounds, with clear onboarding, good first issues, and public discussions.
  - Recognition for contributors and transparent decision-making.

- **Funding and Support:**
  - Free and open source for all users.
  - We welcome sponsorships (e.g., GitHub Sponsors, OpenCollective), grants, and paid support contracts for organizations relying on MCP-Prompts.

- **Infrastructure:**
  - Designed for easy deployment, maintenance, and extension.
  - Robust CI/CD, automated testing, and clear documentation reduce the maintenance burden.

- **Pathways for Growth:**
  - As the project grows, we will expand the maintainer team, explore partnerships, and consider optional paid services or consulting (while keeping the core open source).

**We invite all users and organizations who benefit from MCP-Prompts to contribute code, documentation, funding, or feedback to help ensure its long-term sustainability.**

---

## License

Distributed under the MIT license. See `LICENSE` for more information.

## Project Board & Roadmap

We use a [GitHub Project board](https://github.com/sparesparrow/mcp-prompts/projects) to track issues, features, and roadmap items.
- See what's planned, in progress, and completed.
- Suggest new features or improvements by opening an issue or discussion.

**Contributors:** Please check the board for tasks marked "help wanted" or "good first issue"!

## Project Board Workflow

Our [GitHub Project board](https://github.com/sparesparrow/mcp-prompts/projects) is the central place for tracking issues, features, and roadmap items.

### How it works

- **Automations:**  
  - Issues and PRs with key labels (e.g., `bug`, `enhancement`, `help wanted`) are automatically added to the board.
  - New items are set to the `Todo` status.
  - Cards move automatically when PRs are merged or issues are closed.

- **Columns:**  
  - **Backlog:** Ideas and tasks not yet started.
  - **Todo:** Ready to be picked up.
  - **In Progress:** Actively being worked on.
  - **Review:** Awaiting code review or testing.
  - **Done:** Completed and merged/closed.

### Contributor Guidelines

- **Pick up tasks:**  
  - Look for cards in `Todo` or `Backlog` with the `help wanted` or `good first issue` label.
  - Move the card to `In Progress` when you start work.
  - Move to `Review` when you open a pull request.
  - Move to `Done` when your work is merged or the issue is closed.

- **Use labels:**  
  - Apply relevant labels when opening issues or PRs to help with triage and automation.

- **Task lists:**  
  - For large features, use checklists in issues to break down work into smaller steps.

For more details, see [GitHub Docs: Creating a project](https://docs.github.com/en/issues/planning-and-tracking-with-projects/creating-projects/creating-a-project) and [Quickstart for Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/quickstart-for-projects).

---

## Using the MDC (Cursor Rules) Adapter

To use the MDC adapter for storage:

```
STORAGE_TYPE=mdc
MDC_RULES_DIR=./.cursor/rules
```

Or with Docker:

```
docker run -d --name mcp-prompts \
  -p 3003:3003 \
  -e HTTP_SERVER=true \
  -e STORAGE_TYPE=mdc \
  -e MDC_RULES_DIR=/.cursor/rules \
  -v $(pwd)/.cursor/rules:/.cursor/rules \
  sparesparrow/mcp-prompts:latest
```

See `docs/03-storage-adapters.md` for details.

---

## CLI Usage & Troubleshooting

You can run MCP-Prompts via npx, Docker, or as a Node.js package. For full CLI options, troubleshooting, and advanced usage, see the [User Guide](./USER_GUIDE.md).

Common commands:
```bash
npx -y @sparesparrow/mcp-prompts --help
npm run test:unit
npm run test:integration
```

If you encounter issues, see the FAQ & Troubleshooting section below or open an issue on GitHub.

---

## Roadmap & Quality Improvements

All major features and integrations are now implemented and tested. Remaining roadmap items are tracked as GitHub issues. Experimental features are marked as such in the table below.

| Feature | Status | Notes |
| --- | :---: | --- |
| File storage adapter | ✅ | stable |
| Memory storage adapter | ✅ | stable, for testing/dev |
| PostgreSQL adapter (+ embeddings) | ✅ | since v1.2.x |
| MDC adapter (Cursor Rules) | ✅ | stable, fully tested |
| HTTP server + SSE | ✅ | stable, with compression |
| ElasticSearch adapter | ✅ | since v1.3.x |
| Orchestrator integration | ✅ | basic workflow tool & endpoint |
| Mermaid diagram server | ✅ | basic HTTP endpoint |

Legend: ✅ stable · ⚠️ experimental · 🛠️ in progress

---

## Tasks & Issues

The following are the main areas for future contributions:
- Add support for new prompt types, tools, and workflows
- Ensure compatibility with new MCP SDK and client versions
- Add guides and examples for integration with mobile and desktop apps
- Add more advanced prompt/workflow examples (multi-step, chaining, etc.)
- Add support for environment variable validation and helpful startup errors
- Review and improve security for new endpoints and integrations

> For the full list of open issues and feature requests, see the [GitHub Issues](https://github.com/sparesparrow/mcp-prompts/issues) page.

---

## FAQ & Troubleshooting

**Q: The server starts but I can't access it at http://localhost:3003/health.**
A: Make sure the server is running, the port is not blocked by a firewall, and you are using the correct address. If running in Docker, check port mappings and container status.

**Q: Prompts are not showing up in my client (e.g., Cursor IDE, Claude Desktop, LM Studio).**
A: Double-check the client configuration (server URL, port, and protocol). Ensure MCP-Prompts is running and accessible from the client machine. See the [User Guides](./USER_GUIDE.md) for step-by-step setup.

**Q: How do I add or update environment variables?**
A: You can set environment variables in your shell, `.env` file, or Docker Compose file. See [docs/02-configuration.md](./docs/02-configuration.md) for all supported variables and their defaults.

**Q: How do I chain prompts or create multi-step workflows?**
A: Use templates with variables and reference outputs between steps. See [examples/advanced-workflow-example.json](./examples/advanced-workflow-example.json) and the [Templates Guide](./docs/05-templates-guide.md) for details.

**Q: I get ESM/TypeScript errors when running tests.**
A: Use the provided npm scripts (e.g., `npm run test:unit`) and ensure all imports use explicit `.js` extensions. See the ESM/TypeScript/Jest notes in this README.

**Q: Where can I find more help or report issues?**
A: Check the [User Guides](./USER_GUIDE.md), [docs/](./docs/) directory, or open an issue on [GitHub](https://github.com/sparesparrow/mcp-prompts/issues).

**Q: What does an error response from the API look like?**
A: All HTTP API errors are returned in a standardized JSON format with clear error codes and messages. See [docs/04-api-reference.md](./docs/04-api-reference.md#error-handling-and-response-format) for details and examples.

---

## Orchestrator Integration

The orchestrator feature allows you to define and execute simple workflows (sequences of prompt/template applications) via MCP tool or HTTP endpoint.

- **MCP Tool:** `orchestrate` — Accepts a list of steps (prompt IDs and variables) and returns the results of applying each step in order.
- **HTTP Endpoint:** `POST /orchestrator` — Accepts `{ steps: [{ promptId, variables }] }` and returns the results.

## Mermaid Diagram Server

The Mermaid diagram server provides a simple HTTP endpoint to visualize prompt relationships as Mermaid diagrams.

- **HTTP Endpoint:** `POST /diagram` — Accepts `{ promptIds: [id1, id2, ...] }` and returns a Mermaid diagram string representing a linear flow of the prompts.

--- 

# TODO
```
1. Refactor and Enhance the Main README.md
Task: Restructure the main README.md file to improve clarity and navigation for new contributors.

Instructions:

Add a Table of Contents at the top of the file to allow easy navigation to key sections (e.g., "What is this?", "Features", "Getting Started", "TODO", "Contributing").

Add more shields.io badges to the top of the README. Include badges for 'license', 'last commit', 'open issues', and a link to the CONTRIBUTING.md.

Create a new section titled "Project Philosophy" or "Core Concepts" that briefly explains the idea of the "Master Control Program" (MCP), the role of prompt engineering in this project, and how the different components (server, storage adapters, prompts) work together.

Ensure all links within the README.md are valid and point to the correct files or external resources.

Add a "Show your support" section with a link to your GitHub Sponsors page or other support channels.

2. Implement the PostgresAdapter
Task: The current PostgresAdapter in src/adapters.ts is a placeholder. Implement the full functionality for this adapter.

Instructions:

In src/adapters.ts, locate the PostgresAdapter class.

Use the pg (node-postgres) library to connect to the PostgreSQL database. Connection details should be read from the central configuration (src/config.ts), which in turn reads from environment variables.

Implement the get, set, and list methods to perform the corresponding SQL operations (SELECT, INSERT/UPDATE, SELECT *).

Ensure the implementation correctly handles JSON data by serializing/deserializing it when storing/retrieving it from the database.

The database schema is defined in docker/postgres/init/01-init.sql. Your implementation must be compatible with this schema.

Add robust error handling for database connection errors and query failures.

Create a new integration test file tests/integration/postgres-adapter.integration.test.ts to verify the functionality of the implemented adapter. The test should connect to the test database spun up by Docker and test all public methods of the adapter.

3. Enhance Configuration Management
Task: Improve the configuration management in src/config.ts to be more robust and developer-friendly.

Instructions:

Integrate the zod library to define a schema for all environment variables.

The schema should validate that all required environment variables are present and have the correct type (e.g., PORT should be a number).

At application startup, parse the environment variables using the Zod schema. If validation fails, log a clear error message indicating which variables are missing or invalid, and exit the process.

Update the docker/.env.sample file to include comments explaining each variable.

Update the documentation in docs/02-configuration.md to reflect these changes and list all available environment variables with their purpose and default values.

4. Refactor and Consolidate GitHub Actions Workflows
Task: Simplify and optimize the GitHub Actions workflows located in .github/workflows.

Instructions:

Combine docker-build.yml and docker-publish.yml into a single workflow file named docker-ci-cd.yml.

This new workflow should trigger on pull_request to build the images (without pushing).

It should trigger on release (type created) to build AND push the images to the container registry.

Use workflow conditions (if: github.event_name == 'release') to control the push step.

Analyze npm-publish.yml and npm-publish-github-packages.yml. If they perform similar steps, merge them into a single, more generic publish.yml workflow that takes secrets as inputs to decide the registry target.

In all workflows that use Node.js, ensure you are using the actions/setup-node action's caching feature to speed up npm install.

Review the triggers for all workflows. Ensure they are not running unnecessarily on every push to every branch. Scope them to main or specific paths where possible.

5. Improve Test Coverage
Task: Increase the unit and integration test coverage for the application.

Instructions:

sequence-service.ts: Write new unit tests in tests/unit/sequence-service.unit.test.ts that specifically cover the complex logic of handling sequences, including edge cases like empty sequences, sequences with failing steps, and correct variable interpolation.

http-server.ts: Add more tests to src/__tests__/http-server.test.ts to cover all API endpoints. For each endpoint, test the success case (200 OK), error cases (404 Not Found, 400 Bad Request, 500 Internal Server Error), and input validation. Mock the service dependencies (PromptService, SequenceService).

utils.ts: If any utility functions are not covered by existing tests, add a new unit test file for them.

6. Automate API Documentation Generation
Task: Replace the manual API documentation in docs/04-api-reference.md with an automated solution.

Instructions:

Add extensive TSDoc comments to all API route handlers in src/http-server.ts. Describe what each endpoint does, its parameters (path, query, body), and what it returns.

Use a library like swagger-jsdoc and swagger-ui-express to generate an OpenAPI (Swagger) specification from the TSDoc comments.

Add a new endpoint, /api-docs, to the Express server that serves the interactive Swagger UI.

Remove the content from docs/04-api-reference.md and replace it with a link to the new /api-docs endpoint, explaining that the documentation is now generated automatically and served by the application itself.

7. Create a Detailed CONTRIBUTING.md
Task: Expand the existing CONTRIBUTING.md file into a comprehensive guide for developers.

Instructions:

Create a "Development Setup" section that explains how to use the Docker-based development environment. Provide step-by-step instructions: clone the repo, create a .env file from the sample, and run docker-compose up.

Add a "Project Structure" section that gives a brief overview of the key directories (src, docs, prompts, docker) and files (http-server.ts, prompt-service.ts, adapters.ts).

Add a "Coding Style" section that mentions the use of ESLint and Prettier and instructs contributors to run npm run lint before submitting code.

Add a "Pull Request Process" section that outlines the steps for submitting a PR: fork the repo, create a feature branch, commit your changes, and open a PR against the main branch. Mention that PRs should reference an existing issue if applicable.

8. Update Dependencies and Manage Security
Task: Establish a process for regularly updating dependencies to keep the project secure and up-to-date.

Instructions:

Run npm audit to identify any existing vulnerabilities in the dependencies.

Use npm update to update all packages to their latest minor and patch versions according to the package.json semver rules.

For any vulnerabilities that remain, investigate them and create separate issues for packages that require a major version bump.

Add a new GitHub workflow that runs npm audit weekly and creates an issue if any high or critical severity vulnerabilities are found.
```