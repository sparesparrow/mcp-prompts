# MCP Prompts v3.14.0 Configuration Guide

## Overview

MCP Prompts v3.14.0 introduces **AWS-independent local development** with configurable storage backends. No AWS credentials required for local development!

## Storage Types

### 1. File Storage (Recommended for Development)
**Best for**: Persistent storage, existing prompt collections, development workflows

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "node",
      "args": ["/home/sparrow/projects/mcp/ai-mcp-monorepo/packages/mcp-prompts/dist/index.js"],
      "env": {
        "MODE": "mcp",
        "STORAGE_TYPE": "file",
        "LOG_LEVEL": "info",
        "PROMPTS_DIR": "/home/sparrow/projects/mcp/ai-mcp-monorepo/packages/mcp-prompts/data/prompts"
      }
    }
  }
}
```

### 2. Memory Storage (Recommended for Testing)
**Best for**: Temporary sessions, testing, CI/CD, isolated development

```json
{
  "mcpServers": {
    "mcp-prompts-memory": {
      "command": "node",
      "args": ["/home/sparrow/projects/mcp/ai-mcp-monorepo/packages/mcp-prompts/dist/index.js"],
      "env": {
        "MODE": "mcp",
        "STORAGE_TYPE": "memory",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### 3. AWS Storage (For Production)
**Best for**: Cloud deployments, team collaboration, production environments

```json
{
  "mcpServers": {
    "mcp-prompts-aws": {
      "command": "node",
      "args": ["/home/sparrow/projects/mcp/ai-mcp-monorepo/packages/mcp-prompts/dist/index.js"],
      "env": {
        "MODE": "mcp",
        "STORAGE_TYPE": "aws",
        "LOG_LEVEL": "info",
        "PROMPTS_TABLE": "mcp-prompts",
        "PROMPTS_BUCKET": "mcp-prompts-catalog",
        "PROCESSING_QUEUE": "mcp-prompts-processing"
      }
    }
  }
}
```

## Configuration Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `MODE` | ✅ | - | Must be `"mcp"` for MCP stdio mode |
| `STORAGE_TYPE` | ✅ | `"memory"` | `"file"`, `"memory"`, `"aws"`, or `"postgres"` |
| `PROMPTS_DIR` | For file storage | - | Directory containing prompt JSON files |
| `LOG_LEVEL` | ❌ | `"info"` | `"debug"`, `"info"`, `"warn"`, `"error"` |
| `PROMPTS_TABLE` | For AWS | `"mcp-prompts"` | DynamoDB table name |
| `PROMPTS_BUCKET` | For AWS | `"mcp-prompts-catalog"` | S3 bucket name |
| `PROCESSING_QUEUE` | For AWS | `"mcp-prompts-processing"` | SQS queue name |

## Current Configuration Status

### ✅ Verified Working Configurations

1. **File Storage (Local)**: ✅ Working
   - Loads 45+ prompts from `/home/sparrow/projects/mcp/ai-mcp-monorepo/packages/mcp-prompts/data/prompts`
   - Full CRUD operations supported
   - No AWS dependencies

2. **File Storage (MCP)**: ✅ Working
   - Loads prompts from `/home/sparrow/mcp/data/prompts`
   - Full CRUD operations supported
   - No AWS dependencies

3. **Memory Storage**: ✅ Working
   - In-memory operations
   - Fast, no persistence
   - No AWS dependencies

4. **AWS Storage**: ✅ Working (backward compatible)
   - Full AWS integration maintained
   - Requires AWS credentials
   - Production-ready

### ❌ Not Yet Implemented

- **PostgreSQL Storage**: Planned for v3.15.0
  - Framework prepared
  - Schema designed
  - Implementation pending

## MCP Tools Available

All configurations provide **11 MCP tools**:

1. `get_prompt` - Retrieve specific prompts
2. `list_prompts` - List prompts with pagination
3. `search_prompts` - Search prompts by content/tags
4. `apply_template` - Apply variables to templates
5. `create_prompt` - Create new prompts ✅ **NOW WORKING**
6. `update_prompt` - Update existing prompts ✅ **NOW WORKING**
7. `delete_prompt` - Delete prompts ✅ **NOW WORKING**
8. `slash_command` - Quick template execution
9. `list_slash_commands` - List available commands
10. `suggest_slash_commands` - Command suggestions
11. `get_stats` - System statistics

## Troubleshooting

### Common Issues

#### "Failed to list prompts: TypeError: Cannot read properties of undefined (reading 'join')"
**Solution**: This was fixed in v3.14.0. Update to the latest version.

#### "Invalid time value" errors
**Solution**: Ensure prompt JSON files have valid date strings in `createdAt` and `updatedAt` fields.

#### AWS Security Token Errors
**Solution**: For local development, use `STORAGE_TYPE=file` or `STORAGE_TYPE=memory` instead of `aws`.

### Testing Configuration

Run this command to verify your configuration:

```bash
# Test file storage
cd /home/sparrow/projects/mcp/ai-mcp-monorepo/packages/mcp-prompts
MODE=mcp STORAGE_TYPE=file PROMPTS_DIR="./data/prompts" LOG_LEVEL=info node dist/index.js

# Test memory storage
MODE=mcp STORAGE_TYPE=memory LOG_LEVEL=info node dist/index.js
```

## Migration Guide

### From v3.13.0 and Earlier

**Before (AWS required):**
```json
{
  "env": {
    "STORAGE_TYPE": "aws",
    "PROMPTS_TABLE": "mcp-prompts"
  }
}
```

**After (AWS optional):**
```json
{
  "env": {
    "STORAGE_TYPE": "file",
    "PROMPTS_DIR": "/path/to/prompts"
  }
}
```

### Benefits of Migration

- ✅ **No AWS Credentials Required** for local development
- ✅ **Faster Startup** (no AWS API calls)
- ✅ **Offline Development** possible
- ✅ **Full Functionality** maintained
- ✅ **Backward Compatibility** preserved

## Performance Comparison

| Metric | File Storage | Memory Storage | AWS Storage |
|--------|-------------|----------------|-------------|
| Startup Time | ~3s | ~3s | ~5-10s |
| Read Operations | ⚡ Fast | ⚡ Fastest | Fast |
| Write Operations | ⚡ Fast | ⚡ Fastest | Fast |
| Persistence | ✅ Yes | ❌ No | ✅ Yes |
| AWS Required | ❌ No | ❌ No | ✅ Yes |
| Setup Complexity | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

## Recommended Setup

For **local development**:
- Use `STORAGE_TYPE=file` with your local prompts directory
- Alternative: `STORAGE_TYPE=memory` for quick testing

For **production deployment**:
- Use `STORAGE_TYPE=aws` with proper AWS resources
- PostgreSQL support coming in v3.15.0

## Version History

- **v3.14.0**: AWS-independent local development, configurable storage
- **v3.13.0**: AWS-dependent, limited local functionality
- **v3.0.9**: Basic MCP support
- **v1.x**: Legacy versions (not recommended)