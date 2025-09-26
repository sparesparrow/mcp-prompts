# MCP Prompts Deployment Guide

This guide provides comprehensive deployment instructions for MCP Prompts across different storage backends and deployment targets.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Storage Types](#storage-types)
3. [Deployment Targets](#deployment-targets)
4. [CI/CD Pipelines](#cicd-pipelines)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)
6. [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Node.js 18+ and PNPM
- Docker (for containerized deployments)
- AWS CLI (for AWS deployments)
- PostgreSQL client (for PostgreSQL deployments)

### Choose Your Deployment

```bash
# File Storage (Local JSON files)
./scripts/deploy-file-storage.sh

# PostgreSQL Database
./scripts/deploy-postgres.sh

# AWS Services (DynamoDB, S3, SQS)
./scripts/deploy-aws-enhanced.sh

# Docker Containers
./scripts/deploy-docker.sh
```

## Storage Types

### 1. File Storage (Local JSON)

**Best for:** Development, small deployments, offline usage

**Features:**
- Simple file-based storage
- No external dependencies
- Easy backup and restore
- Perfect for development

**Deployment:**
```bash
./scripts/deploy-file-storage.sh
```

**Configuration:**
```bash
export STORAGE_TYPE=file
export PROMPTS_DIR=./data/prompts
export PORT=3000
```

### 2. PostgreSQL Database

**Best for:** Production applications, complex queries, ACID compliance

**Features:**
- Full ACID compliance
- Complex queries and indexing
- Session management
- Backup and restore capabilities

**Deployment:**
```bash
./scripts/deploy-postgres.sh
```

**Configuration:**
```bash
export STORAGE_TYPE=postgres
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=mcp_prompts
export DB_USER=mcp_user
export DB_PASSWORD=mcp_password
```

### 3. AWS Services

**Best for:** Scalable production applications, cloud-native deployments

**Features:**
- DynamoDB for prompts storage
- S3 for catalog and assets
- SQS for event processing
- API Gateway for HTTP endpoints
- CloudFront for CDN

**Deployment:**
```bash
./scripts/deploy-aws-enhanced.sh
```

**Configuration:**
```bash
export STORAGE_TYPE=aws
export AWS_REGION=us-east-1
export PROMPTS_TABLE=mcp-prompts
export PROMPTS_BUCKET=mcp-prompts-catalog
export PROCESSING_QUEUE=https://sqs.us-east-1.amazonaws.com/account/queue
```

### 4. Memory Storage

**Best for:** Testing, development, temporary deployments

**Features:**
- In-memory storage
- No persistence
- Fast access
- Sample data included

**Configuration:**
```bash
export STORAGE_TYPE=memory
```

## Deployment Targets

### 1. Local Development

```bash
# Install dependencies
pnpm install

# Start with memory storage
STORAGE_TYPE=memory pnpm run dev

# Start with file storage
STORAGE_TYPE=file pnpm run dev

# Start with PostgreSQL
STORAGE_TYPE=postgres pnpm run dev
```

### 2. Docker Containers

```bash
# Build and start with different storage types
./scripts/docker-start.sh memory
./scripts/docker-start.sh file
./scripts/docker-start.sh postgres
./scripts/docker-start.sh aws

# View logs
./scripts/docker-logs.sh memory

# Stop containers
./scripts/docker-stop.sh memory
```

### 3. Production Servers

#### Systemd Service
```bash
# Deploy with systemd service
./scripts/deploy-file-storage.sh --systemd
./scripts/deploy-postgres.sh --systemd

# Manage service
sudo systemctl start mcp-prompts-file
sudo systemctl status mcp-prompts-file
sudo systemctl stop mcp-prompts-file
```

#### Docker Compose
```bash
# Start with docker-compose
docker-compose -f docker-compose.postgres.yml up -d

# Scale services
docker-compose -f docker-compose.postgres.yml up -d --scale mcp-prompts=3
```

### 4. Cloud Platforms

#### AWS
```bash
# Deploy to AWS
./scripts/deploy-aws-enhanced.sh

# Monitor deployment
./scripts/monitor-aws.sh

# Health check
./scripts/health-check-aws.sh
```

#### Kubernetes
```yaml
# Example Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-prompts
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-prompts
  template:
    metadata:
      labels:
        app: mcp-prompts
    spec:
      containers:
      - name: mcp-prompts
        image: ghcr.io/sparesparrow/mcp-prompts:postgres
        ports:
        - containerPort: 3000
        env:
        - name: STORAGE_TYPE
          value: "postgres"
        - name: DB_HOST
          value: "postgres-service"
```

## CI/CD Pipelines

### GitHub Actions

The project includes several GitHub Actions workflows:

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

4. **Security Scanning** (`.github/workflows/security-scan.yml`)
   - Vulnerability scanning
   - Code quality analysis
   - Secret detection

5. **Test Matrix** (`.github/workflows/test-matrix.yml`)
   - Tests across multiple OS and Node.js versions
   - Coverage reporting

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

# Notifications
SLACK_WEBHOOK
```

## Monitoring and Maintenance

### Health Checks

```bash
# File storage
curl http://localhost:3000/health

# PostgreSQL
./scripts/monitor-postgres.sh

# AWS
./scripts/health-check-aws.sh
```

### Backup and Restore

#### File Storage
```bash
# Backup
./scripts/backup-file-storage.sh

# Restore
./scripts/restore-file-storage.sh backup-20240101-120000.tar.gz
```

#### PostgreSQL
```bash
# Backup
./scripts/backup-postgres.sh

# Restore
./scripts/restore-postgres.sh backup-20240101-120000.sql
```

#### AWS
```bash
# Backup
./scripts/backup-aws.sh

# Cleanup (careful!)
./scripts/cleanup-aws.sh
```

### Monitoring Scripts

```bash
# File storage monitoring
./scripts/monitor-file-storage.sh

# PostgreSQL monitoring
./scripts/monitor-postgres.sh

# AWS monitoring
./scripts/monitor-aws.sh
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Issues

**PostgreSQL:**
```bash
# Check connection
PGPASSWORD=mcp_password psql -h localhost -U mcp_user -d mcp_prompts -c "SELECT 1;"

# Check service status
sudo systemctl status postgresql
```

**AWS DynamoDB:**
```bash
# Check table exists
aws dynamodb describe-table --table-name mcp-prompts

# Check permissions
aws sts get-caller-identity
```

#### 2. Docker Issues

```bash
# Check container logs
docker logs mcp-prompts-memory

# Check container status
docker ps -a

# Restart container
docker restart mcp-prompts-memory
```

#### 3. Permission Issues

```bash
# Fix script permissions
chmod +x scripts/*.sh

# Fix data directory permissions
chmod -R 755 data/
```

### Logs and Debugging

```bash
# Enable debug logging
export LOG_LEVEL=debug

# View application logs
tail -f logs/mcp-prompts.log

# Docker logs
docker logs -f mcp-prompts-memory
```

### Performance Tuning

#### PostgreSQL
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Update statistics
ANALYZE;
```

#### AWS DynamoDB
```bash
# Check table metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=mcp-prompts \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

## Best Practices

### Security

1. **Environment Variables**: Never commit secrets to version control
2. **Network Security**: Use firewalls and VPCs in production
3. **Access Control**: Implement proper IAM roles and policies
4. **Encryption**: Enable encryption at rest and in transit

### Performance

1. **Caching**: Implement Redis for session caching
2. **Load Balancing**: Use multiple instances behind a load balancer
3. **Database Optimization**: Proper indexing and query optimization
4. **CDN**: Use CloudFront or similar for static assets

### Monitoring

1. **Health Checks**: Implement comprehensive health checks
2. **Metrics**: Monitor key performance indicators
3. **Alerting**: Set up alerts for critical issues
4. **Logging**: Centralized logging with proper log levels

### Backup and Recovery

1. **Regular Backups**: Automated daily backups
2. **Test Restores**: Regularly test backup restoration
3. **Disaster Recovery**: Multi-region deployment for critical applications
4. **Version Control**: Keep deployment scripts in version control

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review the logs for error messages
3. Check GitHub Issues for known problems
4. Create a new issue with detailed information

## Contributing

To contribute to the deployment scripts:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Note**: Always test deployments in a staging environment before deploying to production.
