# MCP-Prompts

A robust, extensible server for managing, versioning, and serving prompts and templates for LLM applications, built on the Model Context Protocol (MCP) with multi-backend support including AWS, PostgreSQL, and file storage.

## ✨ Features

- **🔄 Multiple Storage Backends**: DynamoDB, PostgreSQL, and local file storage
- **📦 Model Context Protocol**: Full MCP compliance for seamless AI integration
- **🏗️ Hexagonal Architecture**: Clean separation of concerns with adapter pattern
- **⚡ Serverless Ready**: AWS Lambda deployment with API Gateway
- **🔍 Advanced Querying**: Filter by category, tags, and metadata
- **📊 Version Control**: Complete prompt versioning and history
- **🔐 Enterprise Security**: IAM, VPC, and encryption support
- **📈 Monitoring**: CloudWatch metrics and comprehensive logging
- **🧪 Testing**: Full test suite with local development support

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **PNPM**
- **AWS CLI** (for AWS deployments)
- **PostgreSQL** (for database deployments)
- **Docker** (for containerized deployments)

### Choose Your Deployment

#### 🏠 Local Development (File Storage)
```bash
# Install dependencies
pnpm install

# Start with memory storage (fastest)
STORAGE_TYPE=memory pnpm run dev

# Or use file storage
STORAGE_TYPE=file PROMPTS_DIR=./data/prompts pnpm run dev
```

#### 🐘 PostgreSQL Database
```bash
# Deploy with PostgreSQL
./scripts/deploy-postgres.sh

# Or run locally
STORAGE_TYPE=postgres pnpm run dev
```

#### ☁️ AWS Production (Recommended)
```bash
# One-command AWS deployment
./scripts/deploy-aws-enhanced.sh
```

## 📋 Table of Contents

- [Architecture](#-architecture)
- [Storage Types](#-storage-types)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [MCP Integration](#-mcp-integration)
- [AWS Deployment](#-aws-deployment)
- [Monitoring](#-monitoring)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## 🏗️ Architecture

This project follows **hexagonal architecture** (ports & adapters) with clean separation between:

- **Core Business Logic**: Prompt management, versioning, and validation
- **Ports**: Interfaces for storage, events, and external services
- **Adapters**: Concrete implementations (DynamoDB, PostgreSQL, S3, etc.)
- **Infrastructure**: AWS services, HTTP servers, and CLI tools

### Component Diagram

```
┌─────────────────────────────────────┐
│           Presentation Layer        │
│  ┌─────────────┐ ┌────────────────┐ │
│  │   CLI Tool  │ │  HTTP Server   │ │
│  └─────────────┘ └────────────────┘ │
└─────────────────────────────────────┘
                 │
┌─────────────────────────────────────┐
│         Application Layer           │
│  ┌────────────────────────────────┐ │
│  │  Prompt Service & Use Cases   │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
                 │
┌─────────────────────────────────────┐
│            Domain Layer             │
│  ┌────────────────────────────────┐ │
│  │  Prompt Entities & Business   │ │
│  │        Logic                  │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
                 │
┌─────────────────────────────────────┐
│         Infrastructure Layer        │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│  │DDB  │ │PG   │ │S3   │ │SQS  │    │
│  │Adapter│ │Adapter│ │Adapter│ │Adapter│   │
│  └─────┘ └─────┘ └─────┘ └─────┘    │
└─────────────────────────────────────┘
```

## 🔄 Storage Types

### 1. 📁 File Storage (Development)

**Best for:** Development, testing, offline usage

**Features:**
- Simple JSON file-based storage
- No external dependencies
- Easy backup and migration
- Perfect for local development

**Configuration:**
```bash
STORAGE_TYPE=file
PROMPTS_DIR=./data/prompts
```

**Usage:**
```bash
STORAGE_TYPE=file pnpm run dev
```

### 2. 🐘 PostgreSQL Database

**Best for:** Production applications, complex queries, ACID compliance

**Features:**
- Full ACID compliance
- Complex queries and indexing
- Session management
- Backup and restore capabilities
- Concurrent access support

**Configuration:**
```bash
STORAGE_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mcp_prompts
DB_USER=mcp_user
DB_PASSWORD=secure_password
```

**Deployment:**
```bash
./scripts/deploy-postgres.sh
```

### 3. ☁️ AWS Services (Production)

**Best for:** Scalable production, cloud-native deployments

**Features:**
- DynamoDB for metadata storage
- S3 for catalog and assets
- SQS for event processing
- API Gateway for HTTP endpoints
- CloudFront for global CDN
- CloudWatch for monitoring

**Configuration:**
```bash
STORAGE_TYPE=aws
AWS_REGION=us-east-1
PROMPTS_TABLE=mcp-prompts
PROMPTS_BUCKET=mcp-prompts-catalog
PROCESSING_QUEUE=mcp-prompts-processing
```

**Deployment:**
```bash
./scripts/deploy-aws-enhanced.sh
```

### 4. 💾 Memory Storage (Testing)

**Best for:** Unit testing, CI/CD pipelines, temporary deployments

**Features:**
- In-memory storage
- No persistence
- Fastest performance
- Sample data included

**Configuration:**
```bash
STORAGE_TYPE=memory
```

## 📦 Installation

### NPM Package

```bash
# Install globally
npm install -g @sparesparrow/mcp-prompts

# Or use with npx
npx @sparesparrow/mcp-prompts --help
```

### From Source

```bash
# Clone repository
git clone https://github.com/sparesparrow/mcp-prompts.git
cd mcp-prompts

# Install dependencies
pnpm install

# Build project
pnpm run build

# Run locally
STORAGE_TYPE=memory pnpm run dev
```

### Docker

```bash
# Build image
docker build -t mcp-prompts .

# Run with different storage types
docker run -p 3000:3000 -e STORAGE_TYPE=memory mcp-prompts
docker run -p 3000:3000 -e STORAGE_TYPE=file -v $(pwd)/data:/app/data mcp-prompts
```

## ⚙️ Configuration

### Environment Variables

#### Core Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `STORAGE_TYPE` | Storage backend (memory/file/postgres/aws) | `memory` | Yes |
| `NODE_ENV` | Environment (development/production) | `development` | No |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` | No |
| `PORT` | HTTP server port | `3000` | No |

#### File Storage Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PROMPTS_DIR` | Directory for prompt files | `./data/prompts` | No |

#### PostgreSQL Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | Database host | `localhost` | Yes |
| `DB_PORT` | Database port | `5432` | No |
| `DB_NAME` | Database name | `mcp_prompts` | No |
| `DB_USER` | Database user | - | Yes |
| `DB_PASSWORD` | Database password | - | Yes |
| `DB_SSL` | Enable SSL connection | `false` | No |

#### AWS Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AWS_REGION` | AWS region | `us-east-1` | Yes (for AWS storage) |
| `AWS_PROFILE` | AWS profile name | `default` | No |
| `PROMPTS_TABLE` | DynamoDB table name | `mcp-prompts` | No |
| `SESSIONS_TABLE` | Sessions table name | `mcp-sessions` | No |
| `PROMPTS_BUCKET` | S3 bucket name | `mcp-prompts-catalog-{account}-{region}` | No |
| `PROCESSING_QUEUE` | SQS queue URL | - | No |
| `CATALOG_SYNC_QUEUE` | Catalog sync queue URL | - | No |

## 🔌 API Reference

### REST API Endpoints

#### Health & Status
- `GET /health` - Service health check with component status
- `GET /mcp` - MCP server capabilities and supported features

#### Prompts Management
- `GET /v1/prompts` - List prompts with optional filtering
  - Query parameters: `?category=`, `?limit=`, `?offset=`, `?tags=`
- `POST /v1/prompts` - Create new prompt
- `GET /v1/prompts/{id}` - Get specific prompt by ID
- `PUT /v1/prompts/{id}` - Update existing prompt
- `DELETE /v1/prompts/{id}` - Delete prompt
- `POST /v1/prompts/{id}/apply` - Apply template variables

#### MCP Tools
- `GET /mcp/tools` - List available MCP tools
- `POST /mcp/tools` - Execute MCP tool with parameters

### Request/Response Examples

#### Create Prompt
```bash
curl -X POST http://localhost:3000/v1/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Code Review Assistant",
    "description": "Advanced code review helper",
    "template": "Please review this {{language}} code:\n\n```{{language}}\n{{code}}\n```\n\nFocus on:\n- Security issues\n- Performance\n- Best practices",
    "category": "development",
    "tags": ["code-review", "security", "performance"],
    "variables": [
      {"name": "language", "description": "Programming language", "type": "string", "required": true},
      {"name": "code", "description": "Code to review", "type": "string", "required": true}
    ]
  }'
```

#### Apply Template
```bash
curl -X POST http://localhost:3000/v1/prompts/code_review_assistant/apply \
  -H "Content-Type: application/json" \
  -d '{
    "language": "typescript",
    "code": "function hello() { console.log(\"Hello World\"); }"
  }'
```

## 🤖 MCP Integration

### Model Context Protocol Support

MCP-Prompts implements the full Model Context Protocol specification, making it compatible with any MCP-compatible AI assistant or IDE.

#### MCP Server Modes

1. **HTTP Mode** (Default): REST API server
2. **MCP Mode**: Native MCP protocol server
3. **CLI Mode**: Command-line interface

#### Connecting to AI Assistants

**Claude Desktop:**
```json
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["@sparesparrow/mcp-prompts"],
      "env": {
        "STORAGE_TYPE": "aws",
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

**VS Code Extension:**
```json
{
  "mcp": {
    "servers": {
      "prompts": {
        "command": "npx",
        "args": ["@sparesparrow/mcp-prompts"],
        "options": {
          "env": {
            "STORAGE_TYPE": "aws",
            "AWS_REGION": "us-east-1"
          }
        }
      }
    }
  }
}
```

#### Available MCP Tools

- **list_prompts**: Browse available prompts by category
- **get_prompt**: Retrieve specific prompt with full details
- **create_prompt**: Create new prompts programmatically
- **update_prompt**: Modify existing prompts
- **delete_prompt**: Remove prompts
- **apply_prompt**: Apply template variables to generate final prompts

## ☁️ AWS Deployment

### Architecture Overview

The AWS deployment creates a production-ready serverless architecture:

- **API Gateway** - RESTful API endpoints with CORS
- **Lambda Functions** - Serverless compute (MCP server, processing, catalog sync)
- **DynamoDB** - NoSQL storage with global secondary indexes
- **S3** - Object storage for catalog and assets
- **SQS** - Message queuing for async processing
- **CloudFront** - Global CDN for performance
- **CloudWatch** - Monitoring, logging, and metrics

### Quick AWS Deployment

```bash
# Prerequisites: AWS CLI configured
aws configure

# One-command deployment
./scripts/deploy-aws-enhanced.sh
```

### Manual AWS Deployment

```bash
# Install dependencies
pnpm install

# Build project
pnpm run build

# Deploy CDK infrastructure
cd cdk
pnpm install
cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION
cdk deploy --all --require-approval never
```

### AWS Configuration

### AWS Permissions

The deployment creates minimal IAM roles following least-privilege:

| Service | Permissions | Purpose |
|---------|-------------|---------|
| **Lambda** | CloudWatch Logs, VPC access | Function execution and logging |
| **DynamoDB** | Read/write access to tables | Prompt and session storage |
| **S3** | Read/write access to bucket | Catalog storage and assets |
| **SQS** | Send/receive/delete messages | Async processing queues |
| **CloudWatch** | PutMetricData, CreateLogGroups | Monitoring and metrics |

### AWS Cost Optimization

**Free Tier Usage:**
- Lambda: 1M requests/month
- DynamoDB: 25GB storage + 25 RCU/WCU
- S3: 5GB storage + 20K GET + 2K PUT requests
- API Gateway: 1M requests/month

**Estimated Monthly Costs** (beyond free tier):
- **$25-35/month** for moderate usage
- Scales with usage, no fixed costs

### AWS Security Features

- **Encryption at rest** (DynamoDB, S3)
- **Encryption in transit** (HTTPS/TLS)
- **IAM roles** with minimal permissions
- **CloudTrail** audit logging
- **VPC support** (optional)

## 📊 Monitoring

### CloudWatch Metrics

Automatic custom metrics:

- **PromptAccessCount** - Usage tracking by prompt/category
- **OperationLatency** - API response times
- **ApiSuccess/ApiError** - Success/error rates
- **ProcessingLatency** - Background processing times
- **PromptCreated/Updated/Deleted** - CRUD operations

### Health Checks

```bash
# Check all services
curl https://your-api-gateway-url/health

# Expected response
{
  "status": "healthy",
  "services": {
    "dynamodb": {"status": "healthy"},
    "s3": {"status": "healthy"},
    "sqs": {"status": "healthy"}
  }
}
```

### CloudWatch Alarms

Recommended alarms:
- API error rate > 5%
- Average latency > 1000ms
- DynamoDB throttling events
- Lambda error rate > 1%
- SQS dead letter messages > 0

## 🔒 Security

### Network Security
- **VPC Endpoints** for private AWS service access
- **Security Groups** restricting Lambda network access
- **WAF** protection for API Gateway (optional)

### Data Security
- **Encryption at rest** for DynamoDB and S3
- **Encryption in transit** via HTTPS/TLS
- **IAM roles** following least-privilege principle
- **API Gateway authentication** via Cognito (optional)

### Secrets Management
- **AWS Systems Manager Parameter Store** for configuration
- **AWS Secrets Manager** for sensitive data
- **Environment variables** for Lambda configuration

## 🧪 Testing

### Local Development Testing

```bash
# Run unit tests
pnpm test

# Test with local DynamoDB
docker run -p 8000:8000 amazon/dynamodb-local
export DYNAMODB_ENDPOINT=http://localhost:8000
STORAGE_TYPE=memory pnpm run dev
```

### Integration Testing

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test prompts API
curl http://localhost:3000/v1/prompts

# Test prompt creation
curl -X POST http://localhost:3000/v1/prompts \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "template": "Hello {{name}}", "category": "greeting"}'
```

### AWS Integration Testing

```bash
# Test deployed API
curl https://your-api-gateway-url/health

# Test with AWS credentials
AWS_REGION=us-east-1 npx @sparesparrow/mcp-prompts list
```

## 🚨 Troubleshooting

### Common Issues

#### AWS Deployment Issues

1. **403 Access Denied**
   - Check IAM permissions for your AWS user/role
   - Verify resource policies on DynamoDB/S3
   - Check VPC configuration if using private subnets

2. **CDK Bootstrap Required**
   ```bash
   cdk bootstrap aws://ACCOUNT/REGION
   ```

3. **Lambda Timeout**
   - Increase timeout in CDK stack (default: 30s)
   - Optimize cold start performance
   - Check DynamoDB/S3 connection latency

4. **DynamoDB Throttling**
   - Switch to On-Demand billing mode
   - Optimize partition key distribution
   - Implement exponential backoff in clients

#### Storage Issues

5. **PostgreSQL Connection Failed**
   - Verify database credentials
   - Check network connectivity
   - Ensure database is running and accessible

6. **File Storage Permissions**
   ```bash
   chmod -R 755 data/
   ```

#### MCP Integration Issues

7. **MCP Server Not Connecting**
   - Verify environment variables are set
   - Check AWS credentials for cloud storage
   - Ensure correct MCP server mode

### Debug Commands

#### AWS Services
```bash
# Check Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/McpPromptsStack"

# Check DynamoDB table
aws dynamodb describe-table --table-name mcp-prompts

# Check S3 bucket
aws s3 ls s3://your-bucket-name --recursive

# Check SQS queue
aws sqs get-queue-attributes --queue-url your-queue-url --attribute-names All
```

#### Local Development
```bash
# Check application logs
tail -f logs/mcp-prompts.log

# Test database connectivity
STORAGE_TYPE=postgres pg_isready -h localhost -p 5432

# Check Node.js processes
ps aux | grep mcp-prompts
```

### Performance Tuning

#### Lambda Optimization
- Increase memory allocation (more CPU)
- Use provisioned concurrency for latency-sensitive functions
- Optimize package size and dependencies

#### Database Optimization
- Use appropriate indexes
- Implement connection pooling
- Monitor query performance

## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

The repository includes several CI/CD workflows:

1. **CI/CD Pipeline** (`.github/workflows/ci-cd.yml`)
   - Tests on multiple storage types
   - Builds and pushes Docker images
   - Deploys to AWS
   - Publishes to NPM

2. **Multi-Platform Docker Build** (`.github/workflows/docker-multi-platform.yml`)
   - Builds for multiple architectures
   - Pushes to GitHub Container Registry

3. **AWS Deployment** (`.github/workflows/aws-deploy.yml`)
   - Automated AWS deployment
   - Health checks and smoke tests

### Required Secrets

Configure these secrets in your GitHub repository:

```bash
# AWS Deployment
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION

# NPM Publishing
NPM_TOKEN

# Security Scanning
SNYK_TOKEN
```

### Manual Deployment

```bash
# Install dependencies
pnpm install

# Build project
pnpm run build

# Run tests
pnpm test

# Deploy to AWS
./scripts/deploy-aws-enhanced.sh

# Or deploy to Docker
./scripts/deploy-docker.sh
```

## 📚 Further Reading

### AWS Documentation
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Lambda Performance Optimization](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

### MCP Protocol
- [Model Context Protocol Specification](https://github.com/modelcontextprotocol/specification)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)

### Development
- [Hexagonal Architecture](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cunning-architect/)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

## 🤝 Contributing

### Development Setup

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/mcp-prompts.git
   cd mcp-prompts
   ```
3. **Install dependencies**
   ```bash
   pnpm install
   ```
4. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make changes and test**
   ```bash
   pnpm test
   pnpm run build
   ```
6. **Submit pull request**

### Guidelines

- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation for API changes
- Use conventional commit messages
- Test across all storage backends

### Architecture Decisions

- **Hexagonal Architecture**: Ports & Adapters pattern
- **Storage Adapters**: Pluggable storage implementations
- **MCP Compliance**: Full protocol implementation
- **TypeScript**: Strict typing throughout

## 📄 License

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
