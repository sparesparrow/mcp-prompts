# Examples Directory

This directory contains example configuration files and usage snippets for MCP Prompts integrations and supported clients.

## 📁 **Available Examples**

### **MCP Client Configuration Files**

| File | Description | Use Case |
|------|-------------|----------|
| `mcp-prompts-config-file-latest.json` | File storage configuration | Local development, single-user setups |
| `mcp-prompts-config-memory-latest.json` | In-memory storage configuration | Testing, development, temporary usage |
| `mcp-prompts-config-postgres-latest.json` | PostgreSQL storage configuration | Production, multi-user, enterprise |
| `mcp-prompts-config-mdc-latest.json` | MDC format storage configuration | Markdown Cursor integration |

### **Workflow Examples**

| File | Description | Use Case |
|------|-------------|----------|
| `advanced-workflow-example.json` | Multi-step prompt chaining workflow | Complex AI automation, prompt sequences |
| `claude-desktop-config-example.json` | Claude Desktop MCP setup | Claude Desktop integration |
| `mcp-prompts.tailscale-phone.json` | Read-only `mcp-prompts-http` on a Tailscale node: token file, Host allowlist, stateless `/mcp` | Remote phone prompts |

### **Remote phone server over Tailscale**

`mcp-prompts.tailscale-phone.json` is a runbook, not a `--config` file. It shows the
`mcp-prompts-http` command, the environment variables (`MCP_PROMPTS_AUTH_TOKEN_FILE`,
`MCP_PROMPTS_ALLOWED_HOSTS`, `MCP_PROMPTS_PROFILE`) and the client entry for a read-only server
on the phone's tailnet address. Replace `100.x.y.z` and `phone.tailnet-name.ts.net` before use.

## 🚀 **Quick Start**

### **1. File Storage (Recommended for Development)**

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"],
      "env": {
        "STORAGE_TYPE": "file",
        "PROMPTS_DIR": "./prompts",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### **2. In-Memory Storage (Testing)**

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"],
      "env": {
        "STORAGE_TYPE": "memory",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### **3. PostgreSQL Storage (Production)**

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"],
      "env": {
        "STORAGE_TYPE": "postgres",
        "POSTGRES_URL": "postgres://user:pass@localhost:5432/mcp_prompts",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## 🔧 **Configuration Options**

### **Environment Variables**

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `STORAGE_TYPE` | Storage backend type | `file` | No |
| `PROMPTS_DIR` | Directory for file storage | `./prompts` | For file storage |
| `POSTGRES_URL` | PostgreSQL connection string | - | For postgres storage |
| `LOG_LEVEL` | Logging level | `info` | No |
| `PORT` | HTTP server port | `3003` | No |
| `HOST` | HTTP server host | `0.0.0.0` | No |

### **Storage Types**

- **`file`**: JSON files in specified directory
- **`memory`**: In-memory storage (volatile)
- **`postgres`**: PostgreSQL database
- **`mdc`**: Markdown Cursor format

## 📱 **Client Integration**

### **Claude Desktop**

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"],
      "env": {
        "STORAGE_TYPE": "file",
        "PROMPTS_DIR": "~/Documents/mcp-prompts"
      }
    }
  }
}
```

### **Cursor IDE**

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"],
      "env": {
        "STORAGE_TYPE": "memory"
      }
    }
  }
}
```

### **VS Code**

```json
{
  "mcp.servers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"],
      "env": {
        "STORAGE_TYPE": "file",
        "PROMPTS_DIR": "./prompts"
      }
    }
  }
}
```

## 🔄 **Workflow Examples**

### **Basic Prompt Chain**

```json
{
  "id": "code-review-workflow",
  "name": "Code Review Workflow",
  "version": 1,
  "steps": [
    {
      "id": "analyze_code",
      "type": "prompt",
      "promptId": "code-analyzer",
      "input": { "code": "{{ context.source_code }}" },
      "output": "analysis"
    },
    {
      "id": "generate_feedback",
      "type": "prompt",
      "promptId": "feedback-generator",
      "input": { "analysis": "{{ context.analysis }}" },
      "output": "feedback"
    }
  ]
}
```

## 📚 **Additional Resources**

- [MCP Prompts Documentation](../docs/)
- [API Reference](../docs/04-api-reference.md)
- [Storage Adapters](../docs/03-storage-adapters.md)
- [Workflow Guide](../docs/09-workflow-guide.md)

## 🤝 **Contributing**

We welcome contributions of:
- New configuration examples
- Workflow templates
- Client integration examples
- Best practices and use cases

---

*These examples demonstrate the flexibility and power of MCP Prompts for various use cases and environments.*
