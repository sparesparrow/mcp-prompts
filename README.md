# MCP Prompts Server

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/@sparesparrow/mcp-prompts)](https://www.npmjs.com/package/@sparesparrow/mcp-prompts)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.18-green)](https://modelcontextprotocol.io/)

A robust, extensible MCP (Model Context Protocol) server for managing, versioning, and serving prompts and templates for LLM applications with AWS integration.

[Features](#features) • [Installation](#installation) • [Quick Start](#quick-start) • [Configuration](#configuration) • [API](#api) • [Tools](#available-tools) • [Docker](#docker)

</div>

## Overview

MCP Prompts is a production-ready server that implements the Model Context Protocol (MCP) to provide intelligent prompt management, template systems, and AI-powered workflows. It supports multiple storage backends including in-memory, file-based, and AWS services (DynamoDB, S3, SQS).

### Key Capabilities

- **Prompt Management**: Create, read, update, delete, and version prompts
- **Template System**: Variable substitution with type validation
- **Search & Discovery**: Tag-based filtering and full-text search
- **Access Control**: Role-based access with subscription tiers
- **AWS Integration**: Native DynamoDB, S3, and SQS support
- **Rate Limiting**: Configurable per-user and per-tier limits
- **Subscription Management**: Stripe integration for payments
- **Multi-Mode**: Run as MCP server (stdio) or HTTP REST API
- **Docker Support**: Multiple deployment configurations

## Features

### Core Features

- ✅ **MCP Protocol Support**: Full implementation of MCP 1.18 specification
- 🔧 **Multiple Storage Backends**: Memory, File System, AWS (DynamoDB/S3)
- 📝 **Prompt Templates**: Advanced variable substitution and validation
- 🔍 **Advanced Search**: Category, tag, and content-based search
- 🔒 **Security**: Helmet, CORS, rate limiting, and authentication
- 📊 **Monitoring**: CloudWatch metrics and structured logging
- 💳 **Payment Processing**: Stripe integration with webhook support
- 🌐 **REST API**: Optional HTTP server mode for web integrations
- 🐳 **Docker Ready**: Multiple Dockerfile variants for different use cases

### MCP Tools

The server exposes the following MCP tools:

#### Prompt Management Tools

- `add_prompt` - Create a new prompt with metadata
- `get_prompt` - Retrieve a prompt by ID
- `list_prompts` - List all prompts with optional filtering
- `update_prompt` - Update an existing prompt
- `delete_prompt` - Delete a prompt
- `apply_template` - Apply variables to a prompt template
- `get_stats` - Get statistics about stored prompts

#### Template System

Templates support variable substitution with the `{{variableName}}` syntax:

```markdown
Please review this {{language}} code for:
- Security issues
- Performance improvements
- Best practices

Code:
{{code}}
```

## Installation

### NPM Package

```bash
npm install @sparesparrow/mcp-prompts
# or
pnpm add @sparesparrow/mcp-prompts
# or
yarn add @sparesparrow/mcp-prompts
```

### Global CLI

```bash
npm install -g @sparesparrow/mcp-prompts
mcp-prompts --help
```

### Docker

```bash
docker pull ghcr.io/sparesparrow/mcp-prompts:latest
```

## Quick Start

### As MCP Server (stdio)

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"]
    }
  }
}
```

Or using Docker:

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "${HOME}/.mcp-prompts:/app/data",
        "ghcr.io/sparesparrow/mcp-prompts:mcp"
      ]
    }
  }
}
```

### As HTTP Server

```bash
# Using npm
npm install @sparesparrow/mcp-prompts
MODE=http PORT=3000 node node_modules/@sparesparrow/mcp-prompts/dist/index.js

# Using Docker
docker run -p 3000:3000 -e MODE=http ghcr.io/sparesparrow/mcp-prompts:latest
```

### Using CLI

```bash
# Start in MCP mode
mcp-prompts start --mode mcp

# Start HTTP server
mcp-prompts start --mode http --port 3000

# List prompts
mcp-prompts list

# Get a prompt
mcp-prompts get <prompt-id>

# Create a prompt
mcp-prompts create \
  --name "Code Review" \
  --template "Review this {{language}} code..." \
  --category development \
  --tags "code-review,development"

# Search prompts
mcp-prompts search "bug fix"

# Check health
mcp-prompts health
```

## Configuration

### Environment Variables

#### Core Settings

```bash
# Server mode: 'mcp' for stdio or 'http' for REST API
MODE=mcp

# HTTP server settings (when MODE=http)
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Storage backend: 'memory', 'file', or 'aws'
STORAGE_TYPE=memory

# Logging
LOG_LEVEL=info
```

#### AWS Configuration (when using AWS storage)

```bash
AWS_REGION=us-east-1
PROMPTS_TABLE=mcp-prompts
PROMPTS_BUCKET=mcp-prompts-catalog
PROCESSING_QUEUE=mcp-prompts-processing
USERS_TABLE=mcp-prompts-users

# AWS credentials (use IAM roles in production)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

#### Payment Integration (Optional)

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Storage Backends

#### Memory Storage (Default)

Best for development and testing:

```bash
STORAGE_TYPE=memory
```

#### AWS Storage

Production-ready with DynamoDB and S3:

```bash
STORAGE_TYPE=aws
AWS_REGION=us-east-1
PROMPTS_TABLE=mcp-prompts
PROMPTS_BUCKET=mcp-prompts-catalog
```

#### File Storage

Persistent local storage:

```bash
STORAGE_TYPE=file
DATA_DIR=/path/to/data
```

## API

### HTTP Endpoints (when MODE=http)

#### Health & Status

```
GET  /health                      - Health check
GET  /mcp                          - MCP capabilities
GET  /mcp/tools                    - List available MCP tools
POST /mcp/tools                    - Execute an MCP tool
```

#### Prompts API

```
GET    /v1/prompts                 - List prompts
GET    /v1/prompts/:id             - Get specific prompt
POST   /v1/prompts                 - Create new prompt
PUT    /v1/prompts/:id             - Update prompt
DELETE /v1/prompts/:id             - Delete prompt
POST   /v1/prompts/:id/apply       - Apply template variables
```

#### Slash Commands

```
GET  /v1/slash-commands            - List available slash commands
GET  /v1/slash-commands/suggest    - Get command suggestions
POST /v1/slash-commands/execute    - Execute a slash command
```

#### Subscriptions & Payments

```
GET  /v1/subscription/plans        - Get subscription plans
GET  /v1/subscription/status       - Get user subscription status
POST /v1/payment/create-intent     - Create payment intent
POST /v1/subscription/create       - Create subscription
POST /v1/subscription/cancel       - Cancel subscription
POST /v1/webhook/stripe            - Stripe webhook handler
```

### Example API Usage

#### Create a Prompt

```bash
curl -X POST http://localhost:3000/v1/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bug Analyzer",
    "content": "Analyze this bug: {{description}}",
    "isTemplate": true,
    "tags": ["debugging", "analysis"],
    "variables": [
      {
        "name": "description",
        "description": "Bug description",
        "required": true,
        "type": "string"
      }
    ],
    "metadata": {
      "category": "debugging"
    }
  }'
```

#### List Prompts

```bash
# List all prompts
curl http://localhost:3000/v1/prompts

# Filter by category
curl http://localhost:3000/v1/prompts?category=development&limit=10

# Search
curl http://localhost:3000/v1/prompts?search=code%20review
```

#### Apply Template

```bash
curl -X POST http://localhost:3000/v1/prompts/bug_analyzer/apply \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "description": "Login page crashes on mobile devices"
    }
  }'
```

## Available Tools

### MCP Tools Reference

When connected to an MCP client, the following tools are available:

#### `add_prompt`

Create a new prompt.

**Parameters:**
- `name` (string, required): Prompt name
- `content` (string, required): Prompt content/template
- `isTemplate` (boolean): Whether this is a template
- `tags` (array): Tags for categorization
- `variables` (array): Template variables definition
- `metadata` (object): Additional metadata

#### `get_prompt`

Retrieve a specific prompt by ID.

**Parameters:**
- `id` (string, required): Prompt ID

#### `list_prompts`

List all prompts with optional filtering.

**Parameters:**
- `tags` (array, optional): Filter by tags
- `search` (string, optional): Search term

#### `update_prompt`

Update an existing prompt.

**Parameters:**
- `id` (string, required): Prompt ID
- `updates` (object, required): Fields to update

#### `delete_prompt`

Delete a prompt.

**Parameters:**
- `id` (string, required): Prompt ID

#### `apply_template`

Apply variables to a prompt template.

**Parameters:**
- `id` (string, required): Template ID
- `variables` (object, required): Variable values

#### `get_stats`

Get statistics about stored prompts.

**Returns:**
- Total prompts count
- Templates count
- Regular prompts count
- Available tags
- Available categories

## Docker

### Available Images

```bash
# Default image (HTTP mode)
ghcr.io/sparesparrow/mcp-prompts:latest

# MCP server mode (stdio)
ghcr.io/sparesparrow/mcp-prompts:mcp

# AWS integration
ghcr.io/sparesparrow/mcp-prompts:aws

# Memory storage
ghcr.io/sparesparrow/mcp-prompts:memory

# File storage
ghcr.io/sparesparrow/mcp-prompts:file
```

### Docker Compose

```yaml
version: '3.8'

services:
  mcp-prompts:
    image: ghcr.io/sparesparrow/mcp-prompts:latest
    ports:
      - "3000:3000"
    environment:
      - MODE=http
      - PORT=3000
      - STORAGE_TYPE=memory
      - LOG_LEVEL=info
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

### Build from Source

```bash
# Build default image
docker build -t mcp-prompts:latest .

# Build MCP server variant
docker build -f Dockerfile.mcp -t mcp-prompts:mcp .

# Build AWS variant
docker build -f Dockerfile.aws -t mcp-prompts:aws .
```

## Development

### Prerequisites

- Node.js 18+ or compatible runtime
- pnpm 8+ (or npm/yarn)
- Docker (optional)
- AWS CLI (for AWS deployments)

### Setup

```bash
# Clone repository
git clone https://github.com/sparesparrow/mcp-prompts.git
cd mcp-prompts

# Install dependencies
pnpm install

# Build
pnpm run build

# Run tests
pnpm test

# Run in development mode
pnpm run dev

# Run HTTP server
pnpm run dev:http

# Run MCP server
pnpm run dev:mcp
```

### Project Structure

```
mcp-prompts/
├── src/
│   ├── adapters/          # Storage adapters (AWS, Memory, File)
│   ├── core/              # Core domain logic
│   │   ├── entities/      # Domain entities
│   │   ├── services/      # Business logic services
│   │   └── ports/         # Interfaces
│   ├── mcp/               # MCP server implementation
│   ├── lambda/            # AWS Lambda handlers
│   ├── monitoring/        # CloudWatch metrics
│   ├── cli.ts             # CLI entry point
│   ├── index.ts           # HTTP server entry point
│   └── mcp-server-standalone.ts  # MCP stdio server
├── data/                  # Sample data
├── cdk/                   # AWS CDK infrastructure
├── scripts/               # Utility scripts
├── Dockerfile.*           # Docker configurations
└── package.json
```

## AWS Deployment

### Using AWS CDK

```bash
# Configure AWS credentials
aws configure

# Install dependencies
pnpm install

# Deploy infrastructure
cd cdk
cdk deploy --all

# Or use npm script
pnpm run cdk:deploy
```

### Manual Deployment

```bash
# Deploy using script
./scripts/deploy-aws.sh

# Cleanup resources
./scripts/cleanup-aws.sh
```

### Required AWS Resources

- DynamoDB table for prompts storage
- S3 bucket for catalog and artifacts
- SQS queue for async processing
- Lambda functions for serverless execution
- API Gateway for HTTP endpoints
- CloudWatch for monitoring
- Cognito for authentication (optional)

## Sample Prompts

The server includes several sample prompts:

- **Code Review Assistant**: Comprehensive code review template
- **Documentation Writer**: Technical documentation generator
- **Bug Analyzer**: Bug report analysis and investigation
- **Architecture Reviewer**: System architecture evaluation
- **Test Case Generator**: Automated test case creation

## Monitoring & Observability

### Logging

Structured JSON logging with pino:

```javascript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});
```

### Metrics (AWS)

CloudWatch metrics for:
- Request rates
- Error rates
- Latency
- Prompt usage
- Template applications

### Health Checks

```bash
# HTTP health check
curl http://localhost:3000/health

# CLI health check
mcp-prompts health
```

## Security

### Best Practices

- ✅ Runs as non-root user in Docker
- ✅ Helmet middleware for HTTP security headers
- ✅ CORS configuration
- ✅ Rate limiting per user/tier
- ✅ Input validation with Zod
- ✅ AWS IAM roles for production
- ✅ Secrets management via environment variables
- ✅ Regular dependency updates

### Authentication

The HTTP server supports authentication via:
- Bearer tokens in Authorization header
- API Gateway Cognito authorizer (AWS)
- Custom authentication middleware

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

**MCP server not starting**
- Check that no other process is using stdio
- Verify Node.js version (18+ required)
- Check logs: `LOG_LEVEL=debug mcp-prompts start`

**HTTP server connection refused**
- Verify port is not in use: `lsof -i :3000`
- Check firewall settings
- Ensure MODE=http is set

**AWS connection failures**
- Verify AWS credentials: `aws sts get-caller-identity`
- Check IAM permissions for DynamoDB, S3, SQS
- Confirm region is correct

**Template variables not substituting**
- Ensure template has `isTemplate: true`
- Verify variable names match (case-sensitive)
- Check variable syntax: `{{variableName}}`

## License

MIT License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2024 Sparre Sparrow

## Support

- 📖 [Documentation](https://github.com/sparesparrow/mcp-prompts#readme)
- 🐛 [Issue Tracker](https://github.com/sparesparrow/mcp-prompts/issues)
- 💬 [Discussions](https://github.com/sparesparrow/mcp-prompts/discussions)
- 📧 Email: support@sparesparrow.com

## Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [AWS Documentation](https://docs.aws.amazon.com/)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)

## Acknowledgments

Built with:
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [Express](https://expressjs.com/)
- [AWS SDK v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [TypeScript](https://www.typescriptlang.org/)
- [Zod](https://zod.dev/)

---

<div align="center">

**[⬆ Back to Top](#mcp-prompts-server)**

Made with ❤️ by the MCP Community

</div>
