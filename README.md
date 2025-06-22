# MCP Prompts Ecosystem

> 🚀 **Multi-Repository Architecture** - This is the central meta-repository for the MCP Prompts ecosystem.

## 📋 Overview

The MCP Prompts project has been restructured from a monorepo into a federated, multi-repository architecture to improve modularity, scalability, and community contributions. This meta-repository serves as the central hub for documentation, orchestration, and ecosystem management.

## 🏗️ Repository Structure

| Repository | Purpose | Package | Status |
|------------|---------|---------|--------|
| **[mcp-prompts-ts](https://github.com/sparesparrow/mcp-prompts-ts)** | TypeScript server implementation | `@sparesparrow/mcp-prompts` | ✅ Active |
| **[mcp-prompts-contracts](https://github.com/sparesparrow/mcp-prompts-contracts)** | API contracts and schemas | `@sparesparrow/mcp-prompts-contracts` | ✅ Active |
| **[mcp-prompts-collection](https://github.com/sparesparrow/mcp-prompts-collection)** | Prompt catalog and templates | `@sparesparrow/mcp-prompts-catalog` | ✅ Active |
| **[mcp-prompts-rs](https://github.com/sparesparrow/mcp-prompts-rs)** | Rust implementation | `mcp-prompts-rs` | ✅ Active |
| **[mcp-prompts-pg](https://github.com/sparesparrow/mcp-prompts-pg)** | PostgreSQL adapter | - | ✅ Active |
| **[mcp-prompts-aidl](https://github.com/sparesparrow/mcp-prompts-aidl)** | Android implementation | - | ✅ Active |

## 🚀 Quick Start

### For Users

The easiest way to get started is with the TypeScript implementation:

```bash
# Run with NPX
npx -y @sparesparrow/mcp-prompts@latest

# Or with Docker
docker run -d --name mcp-server \
  -p 3003:3003 \
  -v $(pwd)/data:/app/data \
  ghcr.io/sparesparrow/mcp-prompts:latest
```

### For Developers

Each repository is self-contained and can be developed independently:

```bash
# Clone the TypeScript implementation
git clone https://github.com/sparesparrow/mcp-prompts-ts.git
cd mcp-prompts-ts
npm install
npm run dev

# Clone the Rust implementation
git clone https://github.com/sparesparrow/mcp-prompts-rs.git
cd mcp-prompts-rs
cargo build
```

## 📚 Documentation

- **[Migration Guide](MIGRATION.md)** - Detailed migration plan and rationale
- **[Architecture Overview](docs/designs/mcp-prompts-restrukturalizace.md)** - Strategic analysis and design
- **[API Reference](https://github.com/sparesparrow/mcp-prompts-ts#api-reference)** - Complete API documentation
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to the ecosystem

## 🔄 CI/CD Pipeline

The ecosystem uses a federated CI/CD model with:

- **Shared Workflows**: Reusable GitHub Actions workflows in this meta-repository
- **Cross-Repository Triggers**: `repository_dispatch` events for coordinated releases
- **Automated Publishing**: NPM, Docker Hub, and GitHub Packages integration
- **Dependency Management**: Automated updates and compatibility checks

## 🎯 Key Benefits

### For Users
- **Modular Installation**: Install only the components you need
- **Independent Versioning**: Each component can be updated independently
- **Better Performance**: Smaller, focused packages
- **Clear Ownership**: Each repository has dedicated maintainers

### For Contributors
- **Focused Development**: Work on specific components without distraction
- **Clear Boundaries**: Well-defined APIs and responsibilities
- **Easier Onboarding**: Smaller, more manageable codebases
- **Independent Releases**: Faster iteration cycles

### For the Ecosystem
- **Scalability**: Easy to add new implementations and adapters
- **Interoperability**: Standardized contracts and interfaces
- **Community Growth**: Lower barriers to contribution
- **Reference Implementation**: Clear example of MCP best practices

## 🔗 Links

- **[GitHub Organization](https://github.com/sparesparrow)** - All repositories
- **[NPM Packages](https://www.npmjs.com/org/sparesparrow)** - Published packages
- **[Docker Hub](https://hub.docker.com/r/sparesparrow)** - Container images
- **[Issues](https://github.com/sparesparrow/mcp-prompts/issues)** - Central issue tracking

## 📈 Roadmap

See the **[detailed roadmap](docs/designs/mcp-prompts-restrukturalizace.md)** for upcoming features and milestones.

## 🤝 Contributing

We welcome contributions! Please see the **[Contributing Guide](CONTRIBUTING.md)** for details on how to get started.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/sparesparrow">@sparesparrow</a> and the <a href="https://github.com/sparesparrow/mcp-prompts/graphs/contributors">community</a></sub>
</div>
