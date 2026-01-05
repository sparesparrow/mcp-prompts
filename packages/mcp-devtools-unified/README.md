# MCP DevTools Unified

A unified MCP server for development tooling that integrates with the cognitive architecture.

## Overview

This package consolidates various development tools into a single MCP server that can:
- Perform static code analysis (cppcheck, clang-tidy)
- Execute tests with framework detection
- Manage debugging sessions (GDB/LLDB)
- Analyze Git history for debugging
- Run analysis in Docker containers
- Orchestrate multi-tool workflows

## Integration with Cognitive Architecture

The server integrates with `mcp-prompts` to:
- Query for tool configuration prompts before execution
- Store successful configurations as new cognitive prompts
- Retrieve interpretation prompts for analysis results
- Capture workflow patterns as procedural knowledge

## MCP Tools

### Code Analysis
- `analyze_code` - Unified static analysis (cppcheck/clang-tidy)
- `analyze_changed_code` - Git + static analysis integration

### Testing
- `run_tests` - Test execution with framework detection

### Debugging
- `debug_session_start` - GDB/LLDB session management

### Version Control
- `git_analyze_history` - Commit analysis for debugging

### Containerization
- `docker_exec_analysis` - Run analysis in containers

### Workflow Orchestration
- `workflow_execute` - Multi-tool orchestrated workflows

## Installation

```bash
# From the monorepo root
pnpm install
cd packages/mcp-devtools-unified
pnpm build
```

## Usage

### MCP Mode (stdio)
```bash
# Start the MCP server
pnpm start:mcp

# Or for development
pnpm dev:mcp
```

### Configuration
```json
{
  "mcpServers": {
    "mcp-devtools-unified": {
      "command": "node",
      "args": ["/path/to/mcp-devtools-unified/dist/mcp/devtools-server.js"],
      "env": {
        "LOG_LEVEL": "info",
        "MCP_PROMPTS_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Architecture

```
mcp-devtools-unified/
├── src/
│   ├── domains/              # Tool domain implementations
│   │   ├── code-intel/      # Static analysis tools
│   │   ├── execution/       # Test runners, debuggers
│   │   ├── vcs/            # Git operations
│   │   └── environment/    # Docker, build systems
│   ├── services/
│   │   ├── knowledge-capture.service.ts  # Captures to mcp-prompts
│   │   ├── workflow-orchestration.service.ts
│   │   └── session-manager.service.ts
│   ├── mcp/
│   │   └── devtools-server.ts  # MCP protocol implementation
│   └── adapters/
│       └── mcp-prompts-client.ts  # FlatBuffers client
├── package.json
└── tsconfig.json
```

## Dependencies

- `@sparesparrow/mcp-prompts` - Cognitive prompt management
- `@sparesparrow/mcp-fbs` - FlatBuffers schemas and builders
- `@modelcontextprotocol/sdk` - MCP protocol implementation

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev:mcp
```

## License

Apache-2.0