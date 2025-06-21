# MCP Prompts Server · `@sparesparrow/mcp-prompts`

[![CI](https://github.com/sparesparrow/mcp-prompts/actions/workflows/ci.yml/badge.svg)](../../actions)
[![npm](https://img.shields.io/npm/v/@sparesparrow/mcp-prompts)](https://www.npmjs.com/package/@sparesparrow/mcp-prompts)
[![Docker Pulls](https://img.shields.io/docker/pulls/sparesparrow/mcp-prompts)](https://hub.docker.com/r/sparesparrow/mcp-prompts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Roadmap](https://img.shields.io/badge/Project-Roadmap-5BC0BE?logo=github)](../../projects/1)

**MCP Prompts Server** is a robust solution to the problem of prompt fragmentation across development teams. It serves as the single source of truth for all your prompts, templates, and related metadata, enabling effective versioning, testing, and secure sharing within your organization and with external systems.

---

## Table of Contents
- [Why This Project?](#why-this-project)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Core Concepts and Data Structure](#core-concepts-and-data-structure)
- [Architecture and Roadmap](#architecture-and-roadmap)
- [Contributing and Community](#contributing-and-community)
- [License](#license)
- [Support and Community](#support-and-community)

---

## 🎯 Why This Project? (The Problem It Solves)

Most teams working with AI struggle with chaos: prompts are stored in code, shared documents, or lost in chat histories. This project solves the following problems:

- ❌ **No Versioning:** The inability to track changes and revert to previous, functional versions of prompts.
- ❌ **Difficult Testing:** Complicated A/B testing and evaluation to determine which prompt version performs better.
- ❌ **Security Risks:** Lack of control over who has access to valuable and sensitive prompts.
- ❌ **Inefficient Collaboration:** Developers and team leaders lack a central place to share and approve prompts.

---

## ✨ Key Features

- **🗄️ Flexible Storage:** Native support for files, PostgreSQL, and in-memory. Can be extended for Elasticsearch for full-text search.
- **🏷️ Categorization and Tagging:** Organize your prompts into hierarchical categories and assign tags for easy searching.
- **🔄 Versioning:** Track the history of each prompt, similar to Git.
- **🔒 Access Control (RBAC):** Detailed permission management for users and roles (admin, editor, viewer).
- **🤖 MCP Ecosystem Integration:** Seamless communication with other MCP servers like @filesystem and @github.
- **📄 Automatic Documentation:** Generate OpenAPI specifications directly from the code.
- **🐳 Docker and CLI Support:** Easy deployment with Docker containers and command-line tools for batch operations.
- **📊 Auditing and Metrics:** Track all changes and analyze the usage of individual prompts.

---

## 🚀 Quick Start

> ⚠️ **Requirements:** Node.js 20+ and npm 10+ (due to npm workspaces support).

### 1. Run with NPX
Run the server without a permanent installation with a single command:

```bash
npx -y @sparesparrow/mcp-prompts
```

### 2. Run with Docker
For production deployment with persistent storage:

**File storage:**
```bash
docker run -d --name mcp-server \
  -p 3003:3003 \
  -v $(pwd)/data:/app/data \
  sparesparrow/mcp-prompts:latest
```

**Postgres storage:**
```bash
docker run -d --name mcp-server \
  -p 3003:3003 \
  -v $(pwd)/data:/app/data \
  -e "STORAGE_TYPE=postgres" \
  -e "POSTGRES_URL=your_connection_string" \
  sparesparrow/mcp-prompts:latest
```

### 3. Verify It's Running
Check that the server is running and accessible:

```bash
curl http://localhost:3003/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "1.4.0",
  "storage": "postgres"
}
```

---

## 🏛️ Core Concepts and Data Structure

| Entity    | Attributes                              | Description                                      |
|-----------|-----------------------------------------|--------------------------------------------------|
| Prompt    | name, content, tags, version, metadata  | The basic unit containing the template text.      |
| Category  | name, description, parent_category      | Used for hierarchical organization of prompts.    |
| Template  | variables, validation_rules             | A special type of prompt with dynamic parts.      |
| User      | username, role                          | An account with assigned permissions.             |

---

## 🏗️ Architecture and Roadmap

The project is designed as a modern monorepo with separate packages, which facilitates maintenance and scaling.

| Component  | Description                                      | Technology                        |
|------------|--------------------------------------------------|-----------------------------------|
| core       | Main application logic, API, and storage mgmt.    | Node.js, Express, TypeScript      |
| catalog    | A distributable package with default prompts.     | NPM                               |
| contracts  | Shared TypeScript types and OpenAPI specs.        | OpenAPI, JSON Schema              |

📊 **[Track our detailed progress on the GitHub Project Board](../../projects/1)**

---

## 🤝 Contributing and Community

We welcome community contributions! Whether it's code, documentation, a bug report, or a new idea, your help is appreciated.

Please read our **[Contributor Guide](CONTRIBUTING.md)** to find everything you need.

### ✨ Our Contributors
Thank you to all the wonderful people who have contributed to this project!

[![Contributors](https://contrib.rocks/image?repo=sparesparrow/mcp-prompts)](https://github.com/sparesparrow/mcp-prompts/graphs/contributors)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 📞 Support and Community

- 🐛 **Report a Bug:** [GitHub Issues](../../issues)
- 💬 **Join the Discussion:** [GitHub Discussions](../../discussions)
- 🏢 **Commercial Support & Custom Solutions:** [Sparrow AI & Tech](mailto:support@sparrowai.tech)

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/sparesparrow">@sparesparrow</a> and the <a href="https://github.com/sparesparrow/mcp-prompts/graphs/contributors">community</a></sub>
</div>
