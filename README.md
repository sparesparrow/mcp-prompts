# MCP-Prompts

A comprehensive collection of Model Context Protocol (MCP) prompt templates and tools for various AI-powered workflows and integrations.

## Overview

MCP-Prompts is a repository designed to provide ready-to-use prompt templates and tools for working with the Model Context Protocol. This project includes various prompt templates, integration examples, and utilities to help developers quickly implement MCP-based solutions in their applications.

## Features

- 📝 **Curated Prompt Templates**: Pre-built prompts for common use cases
- 🔧 **MCP Tools Integration**: Ready-to-use tool configurations
- 🚀 **AWS Integration**: Complete AWS deployment examples
- 📚 **Comprehensive Documentation**: Detailed guides and examples
- 🐳 **Docker Support**: Containerized deployments for various MCP servers

## Available MCP Tools

This repository includes configurations and examples for the following MCP tools:

### Core MCP Servers

- **File System Server** (`Dockerfile.file`): Access and manage local file systems
- **Memory Server** (`Dockerfile.memory`): Persistent memory and state management
- **AWS Integration Server** (`Dockerfile.aws`): AWS services integration
- **Generic MCP Server** (`Dockerfile.mcp`): Base MCP server configuration

### Tool Categories

1. **File Operations**: Read, write, search, and manage files
2. **Memory Management**: Store and retrieve conversation context
3. **Cloud Integration**: AWS services (S3, Lambda, DynamoDB, etc.)
4. **Development Tools**: Code analysis, testing, and deployment utilities

## Existing Templates

The repository includes several prompt template categories:

### 1. Development & Coding
- Code review and analysis prompts
- Debugging assistance templates
- Documentation generation guides
- Testing strategy prompts

### 2. AWS Integration
- Infrastructure as Code (CDK) templates
- Serverless deployment prompts
- AWS service configuration guides
- Monitoring and logging setups

### 3. Data Processing
- Data transformation prompts
- Analysis and reporting templates
- ETL pipeline configurations

### 4. System Administration
- Docker containerization guides
- CI/CD pipeline templates
- Environment configuration prompts

## How to Use

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sparesparrow/mcp-prompts.git
   cd mcp-prompts
   ```

2. **Explore available templates**:
   ```bash
   ls -la examples/
   ls -la data/
   ```

3. **Choose your integration method**:
   - Use Docker containers for quick deployment
   - Configure MCP tools directly in your application
   - Adapt templates to your specific needs

### Using Docker Containers

Each MCP server type has a dedicated Dockerfile:

```bash
# Build the file system MCP server
docker build -f Dockerfile.file -t mcp-file-server .

# Build the memory MCP server
docker build -f Dockerfile.memory -t mcp-memory-server .

# Build the AWS integration MCP server
docker build -f Dockerfile.aws -t mcp-aws-server .
```

### Configuring MCP Tools

1. **Create a configuration file** (`.env` based on `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. **Edit configuration** with your specific settings:
   ```env
   MCP_SERVER_PORT=3000
   AWS_REGION=us-east-1
   # Add other required environment variables
   ```

3. **Run the MCP server**:
   ```bash
   docker run -p 3000:3000 --env-file .env mcp-aws-server
   ```

### Integrating with Claude Desktop or Other MCP Clients

Add the MCP server configuration to your client's config file:

```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "mcp-aws-server"],
      "env": {
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

## Examples

### Example 1: File System Operations

```typescript
// Using the file system MCP server
const response = await mcpClient.callTool({
  name: "read_file",
  arguments: {
    path: "./data/sample.json"
  }
});
```

### Example 2: AWS S3 Integration

```typescript
// Upload a file to S3 using AWS MCP server
const response = await mcpClient.callTool({
  name: "s3_upload",
  arguments: {
    bucket: "my-bucket",
    key: "data/file.json",
    content: fileContent
  }
});
```

### Example 3: Memory Management

```typescript
// Store context in memory server
await mcpClient.callTool({
  name: "store_memory",
  arguments: {
    key: "conversation_context",
    value: conversationData
  }
});

// Retrieve stored context
const context = await mcpClient.callTool({
  name: "retrieve_memory",
  arguments: {
    key: "conversation_context"
  }
});
```

### Example 4: Using Prompt Templates

Browse the `examples/` directory for complete prompt templates:

- **Code Review**: `examples/code-review-prompt.md`
- **AWS Deployment**: `examples/aws-deployment-guide.md`
- **Data Analysis**: `examples/data-analysis-template.md`

## AWS Integration Details

For comprehensive AWS integration documentation, see:
- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [`DOCKER_AWS_TEST_REPORT.md`](DOCKER_AWS_TEST_REPORT.md) - AWS Docker testing results
- `cdk/` - AWS CDK infrastructure as code
- `Dockerfile.aws` - AWS-specific MCP server container

### AWS Services Supported

- **S3**: Object storage operations
- **Lambda**: Serverless function management
- **DynamoDB**: NoSQL database operations
- **CloudWatch**: Logging and monitoring
- **IAM**: Identity and access management
- **ECR**: Container registry integration

## Project Structure

```
mcp-prompts/
├── apps/              # Application code
├── cdk/               # AWS CDK infrastructure
├── data/              # Sample data and datasets
├── docs/              # Documentation
├── examples/          # Example prompts and usage
├── layers/            # Lambda layers
├── packages/          # Reusable packages
├── scripts/           # Utility scripts
├── src/               # Source code
├── web/               # Web interface
├── Dockerfile.*       # Various MCP server containers
└── README.md          # This file
```

## Development

### Prerequisites

- Node.js 18+ or compatible runtime
- Docker (for containerized deployments)
- AWS CLI (for AWS integrations)
- Git

### Setup Development Environment

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Run tests:
   ```bash
   npm test
   ```

### Using DevContainers

This project includes DevContainer configurations in `.devcontainer/` for VS Code and GitHub Codespaces:

```bash
# Open in VS Code with Dev Containers extension
code .
# Then: Cmd/Ctrl + Shift + P -> "Reopen in Container"
```

## Contributing

We welcome contributions! Please see [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read our [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before contributing.

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [AWS Documentation](https://docs.aws.amazon.com/)
- [Docker Documentation](https://docs.docker.com/)

## Troubleshooting

### Common Issues

**Issue: MCP server not starting**
- Check that all required environment variables are set
- Verify Docker is running (for containerized deployments)
- Check logs: `docker logs <container-id>`

**Issue: AWS credentials not working**
- Ensure AWS CLI is configured: `aws configure`
- Verify IAM permissions for required services
- Check environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

**Issue: Port already in use**
- Change the port in your configuration
- Stop conflicting services: `docker ps` and `docker stop <container-id>`

## License

**MIT License** - see [LICENSE](LICENSE) file for details.

Copyright (c) 2024 Sparre Sparrow

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Support

For questions and support:
- Open an [issue](https://github.com/sparesparrow/mcp-prompts/issues)
- Join our [discussions](https://github.com/sparesparrow/mcp-prompts/discussions)
- Check the [wiki](https://github.com/sparesparrow/mcp-prompts/wiki) for additional documentation
