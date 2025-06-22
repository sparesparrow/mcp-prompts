# Developer Guide (WIP)

Until this guide is complete, see:

- `CONTRIBUTING.md` – contribution workflow & coding standards.
- `tests/` – examples for unit & integration tests.
- `scripts/` – helper scripts for building, testing, releasing.

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
