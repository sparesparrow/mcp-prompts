# AWS Infrastructure (Enterprise Option)

This directory contains AWS deployment infrastructure for enterprise use cases.

**For most users, the main MCP server with local file storage is sufficient.**

## What's Here

```
archive/aws/
├── adapters/           # AWS-specific storage implementations (DynamoDB, S3)
├── lambda/             # AWS Lambda functions for serverless deployment
├── infrastructure/     # CDK infrastructure as code
├── scripts/            # Deployment scripts
└── Dockerfile.*        # Specialized Docker images for AWS
```

## Enterprise Features

- **DynamoDB Storage**: Scalable prompt storage with global tables support
- **S3 Catalog**: Large-scale prompt catalog storage
- **SQS Processing**: Asynchronous processing queues
- **Lambda Functions**: Serverless API handlers
- **CloudWatch**: Monitoring and logging
- **Cognito**: Authentication and authorization
- **Stripe Integration**: Payment processing for subscriptions

## When to Use

Use this infrastructure when you need:
- Multi-tenant deployments
- Team collaboration at scale
- Enterprise SLA requirements
- Payment/subscription features
- Global distribution
- High availability

## Getting Started

1. **Check Prerequisites**
   ```bash
   cd archive/aws
   # Ensure AWS credentials are configured
   aws sts get-caller-identity
   ```

2. **Deploy Infrastructure**
   ```bash
   cd infrastructure
   cdk deploy --all
   ```

3. **Configure Prompts Service**
   ```bash
   export STORAGE_TYPE=aws
   export AWS_REGION=us-east-1
   export PROMPTS_TABLE=mcp-prompts
   export PROMPTS_BUCKET=mcp-prompts-catalog
   pnpm start
   ```

## Architecture

```
API Gateway → Lambda → DynamoDB
                    ↓
                   S3 (Catalog)
                    ↓
                   SQS (Queue)
```

## Costs

AWS resources will incur charges:
- **DynamoDB**: Pay per request or provisioned capacity
- **S3**: Storage + data transfer
- **Lambda**: Free tier includes 1M requests/month
- **CloudWatch**: Monitoring and logs

See [AWS Pricing](https://aws.amazon.com/pricing/) for details.

## Troubleshooting

For issues with AWS deployment, see [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md) if available, or check the CDK stack outputs.

## Support

For enterprise deployments, contact the maintainers or refer to the project's main documentation.

---

**Note**: This is an archived, optional component. The main mcp-prompts MCP server (in the parent directory) is the recommended approach for most users.
