# MCP Prompts Documentation

Welcome to the MCP Prompts documentation. This guide provides comprehensive information about the MCP Prompts server, its architecture, and usage.

## 📚 **Documentation Index**

### **Getting Started**
- [Quick Start Guide](01-quickstart.md) - Get up and running quickly
- [Configuration](02-configuration.md) - Server configuration options
- [Overview](00-overview.md) - High-level architecture overview

### **Core Features**
- [Storage Adapters](03-storage-adapters.md) - File, memory, and database storage
- [API Reference](04-api-reference.md) - Complete API documentation
- [Templates Guide](05-templates-guide.md) - Working with prompt templates
- [MCP Integration](06-mcp-integration.md) - Model Context Protocol integration

### **Development & Deployment**
- [Developer Guide](07-developer-guide.md) - Development setup and guidelines
- [Roadmap](08-roadmap.md) - Future development plans
- [Workflow Guide](09-workflow-guide.md) - Development workflows

## 🚀 **Quick Start**

### **Run with NPX (Recommended)**
```bash
npx -y @sparesparrow/mcp-prompts
```

### **Run with Docker**
```bash
docker run -d --name mcp-server -p 3003:3003 \
  -v $(pwd)/data:/app/data \
  ghcr.io/sparesparrow/mcp-prompts:latest
```

### **Build from Source**
```bash
git clone https://github.com/sparesparrow/mcp-prompts.git
cd mcp-prompts
pnpm install
pnpm run build
```

## 🏗️ **Architecture**

MCP Prompts follows a clean hexagonal architecture pattern:

- **Core**: Pure domain logic without infrastructure dependencies
- **Ports**: Interfaces defined in core package
- **Adapters**: Infrastructure implementations in adapter packages
- **Apps**: Composition and configuration in apps folder

## 📦 **Features**

- **Full MCP Prompt API**: Create, read, update, delete, list, and apply prompts
- **Multiple Storage Backends**: File, in-memory, PostgreSQL, and pluggable adapters
- **Template System**: Apply variables to prompts with validation
- **OpenAPI & Type Safety**: Auto-generated docs and strict TypeScript types
- **Docker & Compose Support**: Production-ready images and orchestration
- **Extensible**: Add new adapters, tools, or integrations easily

## 🔧 **Development**

### **Build Commands**
```bash
# Build entire workspace
pnpm run build

# Development with watch mode
pnpm run build:watch

# Type checking
pnpm run typecheck

# Clean build artifacts
pnpm run clean
```

### **Testing**
```bash
# Run all tests
pnpm run test

# Run tests for specific package
pnpm -F @sparesparrow/mcp-prompts-core test
```

## 📖 **Additional Resources**

- [Main Repository](https://github.com/sparesparrow/mcp-prompts)
- [TypeScript Implementation](https://github.com/sparesparrow/mcp-prompts-ts)
- [Prompt Catalog](https://github.com/sparesparrow/mcp-prompts-catalog)
- [Contracts](https://github.com/sparesparrow/mcp-prompts-contracts)
- [Rust Implementation](https://github.com/sparesparrow/mcp-prompts-rs)

## 🤝 **Contributing**

We welcome contributions! Please see [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## 📄 **License**

MIT License. © sparesparrow

## 🆘 **Support**

- **Bugs & Issues**: [GitHub Issues](https://github.com/sparesparrow/mcp-prompts/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sparesparrow/mcp-prompts/discussions)
- **Documentation**: [GitHub Wiki](https://github.com/sparesparrow/mcp-prompts/wiki) 