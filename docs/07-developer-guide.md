# Developer Guide

This guide helps you contribute to MCP-Prompts, extend its features, and understand its architecture.

> **MCP-Prompts** is built with hexagonal architecture: core logic is isolated from adapters and transports, making it easy to add new storage, APIs, or integrations. See [Overview](00-overview.md) and [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution workflow.

Until this guide is complete, see:

- `CONTRIBUTING.md` – contribution workflow & coding standards.
- `tests/` – examples for unit & integration tests.
- `scripts/` – helper scripts for building, testing, releasing.

---

## Automated UI Testing with Puppeteer

MCP-Prompts includes automated end-to-end UI tests for the MCP Inspector and server using [Puppeteer](https://pptr.dev/).

- **Location:** `apps/server/tests/`
- **Test files:**
  - `mcp-inspector-ui.test.js` – Inspector UI smoke test
  - `mcp-inspector-prompt-crud.test.js` – Prompt CRUD UI test

### How to Run UI Tests

1. Ensure the MCP server and Inspector are running (see project README).
2. In the project root, run:
   ```sh
   node --experimental-vm-modules apps/server/tests/mcp-inspector-ui.test.js
   node --experimental-vm-modules apps/server/tests/mcp-inspector-prompt-crud.test.js
   ```
   (Or use `pnpm exec` if preferred.)

### How to Extend UI Tests
- Copy an existing test file and modify selectors/actions for new flows.
- Use Puppeteer's API to simulate user actions and assert UI state.
- Prefer `[data-testid]` attributes for stable selectors.

### Interpreting Results
- Exit code 0: test passed, UI functional.
- Exit code 1: test failed, see console output for error details.

---

## GitHub Actions Workflows Summary

MCP-Prompts uses a set of GitHub Actions workflows for CI/CD, testing, publishing, and automation. Below is a summary of each workflow:

| Workflow File                     | Display Name                 | Purpose & Main Jobs                                                                                                                   | Triggers                    |
| --------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `ci.yml`                          | CI                           | Main continuous integration: lint, format, test (unit/integration), build, audit, coverage, Docker tests, publish to npm & DockerHub. | Push, PR to `main`          |
| `build-publish.yml`               | Build and Publish Package    | Build, test, lint, publish to npm and DockerHub on tag.                                                                               | Push to `main`, tags        |
| `docker-publish.yml`              | Publish Docker image to GHCR | Build and push Docker image to GitHub Container Registry (GHCR) on release.                                                           | Release published           |
| `publish.yml`                     | Publish                      | Build and publish npm package and Docker image.                                                                                       | Release published           |
| `npm-publish.yml`                 | Node.js Package              | Test and publish npm package to npmjs.org on release.                                                                                 | Release created             |
| `npm-publish-github-packages.yml` | Node.js Package              | Test and publish npm package to GitHub Packages on release.                                                                           | Release created             |
| `release.yml`                     | Automatic Release Creation   | Scheduled or manual release: versioning, notes, build, publish to npm/PyPI, tag, create release.                                      | Schedule, workflow_dispatch |
| `typescript.yml`                  | TypeScript                   | Detect, build, and publish TypeScript packages (monorepo support).                                                                    | Push/PR to `main`, release  |
| `python.yml`                      | Python                       | Detect, build, and publish Python packages (monorepo support).                                                                        | Push/PR to `main`, release  |
| `node.js.yml`                     | Node.js CI                   | Test build and run tests across Node.js versions.                                                                                     | Push/PR to `main`           |
| `version-check.yml`               | Version Consistency Check    | Ensure version consistency between package.json and version.ts.                                                                       | Push/PR to `main`, release  |
| `todo-to-issue.yml`               | Run TODO to Issue            | Converts TODO comments in code to GitHub issues.                                                                                      | Push                        |

> See [GitHub Actions documentation](https://docs.github.com/en/actions) for more on workflow syntax, triggers, and best practices.

Reusable workflows are not currently used, but can be added for further DRY automation ([see docs](https://docs.github.com/en/actions/sharing-automations/reusing-workflows)).

---
