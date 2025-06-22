# MCP Prompts Server · `@sparesparrow/mcp-prompts`

[![CI](https://github.com/sparesparrow/mcp-prompts/actions/workflows/ci.yml/badge.svg)](../../actions)
[![npm](https://img.shields.io/npm/v/@sparesparrow/mcp-prompts)](https://www.npmjs.com/package/@sparesparrow/mcp-prompts)
[![Docker Pulls](https://img.shields.io/docker/pulls/sparesparrow/mcp-prompts)](https://hub.docker.com/r/sparesparrow/mcp-prompts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Roadmap](https://img.shields.io/badge/Project-Roadmap-5BC0BE?logo=github)](../../projects/1)

**The reference implementation of the Model Context Protocol (MCP) server for prompt management** – designed for storing, managing, and providing prompts and templates for Large Language Model (LLM) interactions. This repository serves as the _Source of Truth_ for the API contract and provides a rapid development environment for the MCP ecosystem.

![Demo GIF](https://github.com/sparesparrow/mcp-prompts/raw/main/docs/assets/demo.gif)

## 🎯 Why MCP Prompts Server?

Stop scattering prompts across code, Slack, and documents. This server solves real problems that developers and teams face when working with LLMs:

- **🏢 Centralize Team Prompts**: Manage all prompts in one place with consistent API and versioning
- **🔄 A/B Test & Optimize**: Programmatically test different prompt versions to find the most effective ones
- **🏗️ Build Complex AI Agents**: Chain prompts from multiple MCP servers (@prompts, @filesystem, @github) for sophisticated workflows
- **🔐 Secure Prompt Access**: Full control over who can read and modify your valuable prompts
- **📊 Track Performance**: Monitor which templates achieve the best results

## ✨ Key Features

- **🗄️ Flexible Storage**: File-based, in-memory, PostgreSQL, and MDC format support
- **🔧 Dynamic Templates**: Use `{{variables}}` for dynamic content generation
- **🌐 Ecosystem Ready**: Seamless integration with @filesystem, @github, and orchestrators
- **📡 Versioned API**: Stable and predictable REST API for all operations
- **🏥 Health Monitoring**: Built-in `/health` endpoint for container orchestration
- **🔒 Security First**: Designed with security in mind and authentication support

## 🚀 Quick Start

> ⚠️ **Requirements**: Node.js 20+ and npm 10+ (for npm workspaces support)

### NPX (Recommended)

Run the server without permanent installation:

```bash
npx -y @sparesparrow/mcp-prompts
```

### Docker

For containerized environments with persistent storage:

```bash
docker run -d --name mcp-server \
  -p 3003:3003 \
  -v $(pwd)/data:/app/data \
  sparesparrow/mcp-prompts:latest
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
services:
  prompts:
    image: sparesparrow/mcp-prompts:latest
    ports:
      - '3003:3003'
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3003/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Run with: `docker compose up -d`

### Verify Installation

Check if the server is running:

```bash
curl http://localhost:3003/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-06-20T18:56:00.000Z",
  "version": "1.4.0"
}
```

## 📖 Usage Examples

### REST API

```bash
# List all prompts
curl http://localhost:3003/prompts

# Get specific prompt
curl http://localhost:3003/prompts/code-review

# Create new prompt
curl -X POST http://localhost:3003/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-prompt",
    "content": "You are an expert in {{topic}}. Answer the following question.",
    "variables": ["topic"]
  }'

# Apply template with variables
curl -X POST http://localhost:3003/prompts/my-prompt/apply \
  -H "Content-Type: application/json" \
  -d '{"topic": "cybersecurity"}'
```

### TypeScript Integration

```typescript
import { MCPClient } from '@sparesparrow/mcp-prompts-client'; // Future package

const client = new MCPClient('http://localhost:3003');

// Get prompt with applied variables
const prompt = await client.applyTemplate('code-review', {
  language: 'TypeScript',
  context: 'security review',
});

console.log(prompt);
// Output: "Review this TypeScript code from a security review perspective."
```

### Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"]
    }
  }
}
```

## 🔧 Configuration

The server can be configured using environment variables:

| Variable       | Description                                | Default              |
| -------------- | ------------------------------------------ | -------------------- |
| `STORAGE_TYPE` | Storage type: 'file', 'postgres', or 'mdc' | `file`               |
| `PROMPTS_DIR`  | Directory for storing prompts              | `~/mcp/data/prompts` |
| `PORT`         | Port for HTTP server                       | `3003`               |
| `LOG_LEVEL`    | Logging level                              | `info`               |
| `HTTP_SERVER`  | Enable HTTP server                         | `false`              |

<details>
<summary>📚 <strong>Complete Configuration Guide</strong></summary>

### PostgreSQL Setup

```bash
export STORAGE_TYPE=postgres
export POSTGRES_CONNECTION_STRING="postgresql://user:pass@localhost:5432/mcp_prompts"
```

### File Storage Setup

```bash
export STORAGE_TYPE=file
export PROMPTS_DIR=/path/to/prompts
```

### MDC Format Setup (Cursor Rules)

```bash
export STORAGE_TYPE=mdc
export MDC_RULES_DIR=./.cursor/rules
```

For detailed configuration options, see our [Configuration Guide](docs/configuration.md).

</details>

## 🏗️ Architecture & Roadmap

The project is undergoing strategic refactoring to a modular **"Core + Catalog + Contracts"** architecture using npm workspaces. This design improves maintainability and enables easier contributions.

| Phase   | Status         | Description                                         |
| ------- | -------------- | --------------------------------------------------- |
| Phase 0 | 🟡 In Progress | Workspace Initialization                            |
| Phase 1 | 📋 Planned     | Prompt Catalog Separation (`mcp-prompts-catalog`)   |
| Phase 2 | 📋 Planned     | Shared Contracts Creation (`mcp-prompts-contracts`) |
| Phase 3 | 📋 Planned     | Build & Release Pipeline Automation                 |

📊 **[Track our detailed progress on GitHub Project Board](../../projects/1)**

### 🎯 Refactoring Tasks

Our refactoring tasks are organized into specific, actionable Cursor rules that can be executed by AI agents:

- **[@TODO-workspace-setup.mdc](.cursor/rules/TODO-workspace-setup.mdc)** - Initialize npm workspaces and project structure
- **[@TODO-catalog-extraction.mdc](.cursor/rules/TODO-catalog-extraction.mdc)** - Extract prompt catalog into separate package
- **[@TODO-contracts-creation.mdc](.cursor/rules/TODO-contracts-creation.mdc)** - Create shared API contracts and testing
- **[@TODO-pipeline-automation.mdc](.cursor/rules/TODO-pipeline-automation.mdc)** - Automate build and release processes
- **[@TODO-documentation-update.mdc](.cursor/rules/TODO-documentation-update.mdc)** - Finalize documentation and cleanup

To work on specific tasks, simply reference them in your Cursor agent:

```
@TODO-workspace-setup.mdc proceed implementing and elaborating the TODOs and tasks
```

## 🌐 MCP Ecosystem Integration

Seamlessly integrate with other MCP servers using standardized URI patterns:

```bash
# Reference filesystem content in prompts
@filesystem:/path/to/file.txt

# Include git history
@github:sparesparrow/mcp-prompts/history

# Memory context
@memory:conversation-context
```

### Multi-Server Setup

```yaml
# docker-compose.yml for full MCP stack
services:
  prompts:
    image: sparesparrow/mcp-prompts:latest
    ports: ['3003:3003']

  filesystem:
    image: modelcontextprotocol/filesystem:latest
    ports: ['3004:3004']

  github:
    image: modelcontextprotocol/github:latest
    ports: ['3005:3005']
```

## 🤝 Contributing

We welcome contributions from the community! Whether it's code, documentation, bug reports, or new ideas – your help is appreciated.

Please read our **[Contributing Guide](CONTRIBUTING.md)** for:

- Local development setup
- "Contracts-first" development philosophy
- Testing and linting procedures
- Commit message and PR guidelines

### ✨ Contributors

Thanks to all the amazing people who have contributed to this project!

[![Contributors](https://contrib.rocks/image?repo=sparesparrow/mcp-prompts)](https://github.com/sparesparrow/mcp-prompts/graphs/contributors)

## 📚 Documentation

- 📖 [Configuration Guide](docs/configuration.md)
- 📘 [Interactive API Documentation](https://sparesparrow.github.io/mcp-prompts/api) (OpenAPI/Swagger)
- 🏗️ [Architecture Overview](docs/architecture.md)
- 🔐 [Security Best Practices](docs/security.md)
- 🐳 [Docker Deployment Guide](docs/docker.md)

## ☁️ One-Click Deployments

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/mcp-prompts)
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/sparesparrow/mcp-prompts)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sparesparrow/mcp-prompts)

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 📞 Support & Community

- 🐛 **Report bugs**: [GitHub Issues](../../issues)
- 💬 **Discussions**: [GitHub Discussions](../../discussions)
- 📧 **Commercial support**: [Sparrow AI & Tech](mailto:support@sparrowai.tech)
- 🌟 **Star us on GitHub** if this project helped you!
  proceed

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/sparesparrow">@sparesparrow</a> and the <a href="https://github.com/sparesparrow/mcp-prompts/graphs/contributors">community</a></sub>
</div>
