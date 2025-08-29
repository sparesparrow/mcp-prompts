# MCP Prompts Server

A robust, extensible server for managing, versioning, and serving prompts and templates for LLM applications, built on the Model Context Protocol (MCP).

## 🚀 Features

### Dual Mode Operation
- **HTTP Mode** - Traditional REST API server
- **MCP Mode** - Model Context Protocol server for AI assistants

### MCP Tools (7 Available)
1. **`add_prompt`** - Add new prompts to collection
2. **`get_prompt`** - Retrieve prompts by ID
3. **`list_prompts`** - List prompts with filtering
4. **`update_prompt`** - Update existing prompts
5. **`delete_prompt`** - Remove prompts
6. **`apply_template`** - Apply variables to template prompts
7. **`get_stats`** - Get prompt statistics

### Pre-loaded Templates
- Code Review Assistant
- Documentation Writer
- Bug Analyzer
- Architecture Reviewer
- Test Case Generator

## 📦 Installation

```bash
npm install @sparesparrow/mcp-prompts
```

## 🎯 Quick Start

### HTTP Mode
```bash
# Start HTTP server
npm start
# or
MODE=http node dist/index.js

# Server runs on http://localhost:3003
# API docs: http://localhost:3003/api-docs
# Health check: http://localhost:3003/health
```

### MCP Mode
```bash
# Start MCP server
MODE=mcp node dist/index.js
# or
npm run start:mcp
```

## 🔧 Cursor Integration

1. **Configure Cursor MCP:**
   Add to `.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "mcp-prompts": {
         "command": "node",
         "args": ["dist/index.js"],
         "env": {
           "MODE": "mcp"
         }
       }
     }
   }
   ```

2. **Restart Cursor** to load the MCP server

3. **Use in Cursor:**
   - The MCP tools will be available in Cursor's AI assistant
   - You can ask Cursor to manage prompts using natural language

## 🐳 Docker Support

### Build MCP Docker Image
```bash
pnpm run docker:build:mcp
```

### Run with Docker Compose
```bash
pnpm run docker:up:mcp
```

### View Logs
```bash
pnpm run docker:logs:mcp
```

## 📚 Documentation

- **[MCP_README.md](MCP_README.md)** - Comprehensive MCP usage guide
- **[API Documentation](docs/)** - Full API reference
- **[Examples](examples/)** - Usage examples and configurations

## 🛠 Development

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Setup
```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Start development server
pnpm run dev
```

### Available Scripts
```bash
# Build
pnpm run build
pnpm run build:clean

# Start servers
pnpm run start          # Default mode
pnpm run start:http     # HTTP mode
pnpm run start:mcp      # MCP mode

# Docker
pnpm run docker:build:mcp
pnpm run docker:up:mcp
pnpm run docker:down:mcp

# Testing
pnpm run test
pnpm run test:watch

# Linting & Formatting
pnpm run lint
pnpm run format
```

## 📊 Project Structure

```
mcp-prompts/
├── src/
│   ├── index.ts           # Main entry point
│   ├── mcp-server.ts      # MCP server implementation
│   ├── http-server.ts     # HTTP server implementation
│   └── utils.ts           # Utility functions
├── data/
│   └── sample-prompts.json # Pre-loaded templates
├── dist/                  # Compiled output
├── docs/                  # Documentation
├── examples/              # Usage examples
└── docker/                # Docker configurations
```

## 🔍 Testing

### MCP Server Testing
```bash
# Test MCP server functionality
node test-mcp-complete.js
```

### HTTP Server Testing
```bash
# Start HTTP server
pnpm run start:http

# Test endpoints
curl http://localhost:3003/health
curl http://localhost:3003/api-docs
```

## 📈 Usage Examples

### Using MCP Tools

#### List All Prompts
```json
{
  "method": "tools/call",
  "params": {
    "name": "list_prompts",
    "arguments": {}
  }
}
```

#### Apply Template
```json
{
  "method": "tools/call",
  "params": {
    "name": "apply_template",
    "arguments": {
      "id": "code_review_assistant",
      "variables": {
        "language": "JavaScript",
        "code": "function hello() { console.log('Hello World'); }"
      }
    }
  }
}
```

#### Add New Prompt
```json
{
  "method": "tools/call",
  "params": {
    "name": "add_prompt",
    "arguments": {
      "name": "My Custom Prompt",
      "content": "This is a custom prompt for {{subject}}",
      "isTemplate": true,
      "tags": ["custom", "example"],
      "variables": [
        {
          "name": "subject",
          "description": "The subject to process",
          "required": true,
          "type": "string"
        }
      ]
    }
  }
}
```

## 🌟 Features

- **Template Variables** - Use `{{variable}}` syntax for dynamic content
- **Tag System** - Organize prompts with tags for easy filtering
- **Metadata Support** - Add categories, difficulty, time estimates
- **Version Control** - Track prompt versions and changes
- **Error Handling** - Comprehensive error handling and logging
- **TypeScript** - Full TypeScript support with type definitions
- **Docker Ready** - Containerized deployment support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues:** [GitHub Issues](https://github.com/sparesparrow/mcp-prompts/issues)
- **Documentation:** [MCP_README.md](MCP_README.md)
- **Examples:** [examples/](examples/)

---

**Version:** 3.0.8  
**Status:** ✅ Production Ready  
**MCP Support:** ✅ Full Implementation  
**Cursor Integration:** ✅ Ready
