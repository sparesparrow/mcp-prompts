# MCP-Prompts AWS Deployment

A production-ready AWS deployment of the MCP-Prompts ecosystem using serverless architecture with S3, SQS, and DynamoDB.

## 🏗️ Architecture

This implementation follows the hexagonal architecture pattern and deploys to AWS using:

- **AWS Lambda** - Serverless compute for MCP server and processing
- **API Gateway** - RESTful API endpoints with CORS support  
- **DynamoDB** - NoSQL database for prompt metadata and caching
- **S3** - Object storage for prompt catalog and static assets
- **SQS** - Message queuing for asynchronous processing
- **CloudFront** - Global CDN for performance optimization
- **CloudWatch** - Monitoring, logging, and metrics

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and PNPM
- AWS CLI configured with appropriate permissions
- AWS CDK CLI (`npm install -g aws-cdk`)

### One-Command Deployment

Deploy everything to AWS

```
./scripts/deploy-aws.sh

```

### Manual Deployment

Install dependencies
```
pnpm install
```
Build project
```
pnpm run build
```
Deploy infrastructure
```
cd cdk
pnpm install
cdk bootstrap
cdk deploy --all
```

## 🔧 Configuration

### Environment Variables

AWS Configuration

```
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
```
DynamoDB Tables
```
PROMPTS_TABLE=mcp-prompts
SESSIONS_TABLE=mcp-sessions
```
S3 Buckets
```
PROMPTS_BUCKET=mcp-prompts-catalog-{account}-{region}
```
SQS Queues
```
PROCESSING_QUEUE=mcp-prompts-processing
CATALOG_SYNC_QUEUE=mcp-catalog-sync
```
Application
```
NODE_ENV=production
LOG_LEVEL=info

```

### AWS Permissions

The deployment creates minimal IAM roles with these permissions:

- **Lambda Execution Role**: CloudWatch Logs, VPC (if needed)
- **API Gateway Role**: Lambda invoke permissions
- **DynamoDB**: Read/write access to prompt tables
- **S3**: Read/write access to catalog bucket
- **SQS**: Send/receive/delete messages
- **CloudWatch**: PutMetricData permissions

## 📊 API Endpoints

### Health & Status
- `GET /health` - Service health check
- `GET /mcp` - MCP capabilities

### Prompts Management
- `GET /v1/prompts` - List prompts (supports ?category= and ?limit=)
- `POST /v1/prompts` - Create new prompt
- `GET /v1/prompts/{id}` - Get specific prompt
- `PUT /v1/prompts/{id}` - Update prompt
- `DELETE /v1/prompts/{id}` - Delete prompt
- `POST /v1/prompts/{id}/apply` - Apply template variables

### MCP Tools
- `GET /mcp/tools` - List available MCP tools
- `POST /mcp/tools` - Execute MCP tool

## 🔍 Monitoring

### CloudWatch Metrics

The deployment automatically creates custom metrics:

- **PromptAccessCount** - Prompt usage by ID and category
- **OperationLatency** - API response times
- **ApiSuccess/ApiError** - Success/error rates by endpoint
- **ProcessingLatency** - Background processing times
- **PromptCreated/Updated/Deleted** - CRUD operation counts

### CloudWatch Dashboards

After deployment, create dashboards to monitor:

1. **API Performance** - Latency, throughput, error rates
2. **DynamoDB Metrics** - Read/write capacity, throttles
3. **Lambda Metrics** - Duration, errors, concurrency
4. **S3 Usage** - Requests, data transfer, storage

### Alarms

Set up CloudWatch alarms for:

- API error rate > 5%
- Average latency > 1000ms
- DynamoDB throttling events
- Lambda error rate > 1%
- SQS dead letter queue messages

## 💰 Cost Optimization

### AWS Free Tier Usage

This deployment is optimized for AWS Free Tier:

- **Lambda**: 1M requests/month free
- **DynamoDB**: 25GB storage + 25 RCU/WCU free
- **S3**: 5GB storage + 20K GET + 2K PUT requests free
- **API Gateway**: 1M requests/month free
- **CloudWatch**: Basic monitoring free

### Estimated Monthly Costs

For moderate usage (beyond free tier):

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Lambda | 2M requests | ~$4.00 |
| DynamoDB | 50GB + 100 RCU/WCU | ~$15.00 |
| S3 | 20GB storage | ~$0.50 |
| API Gateway | 2M requests | ~$7.00 |
| CloudWatch | Standard monitoring | ~$3.00 |
| **Total** | | **~$29.50** |

### Cost Reduction Tips

1. **Use DynamoDB On-Demand** for unpredictable workloads
2. **Enable S3 Intelligent Tiering** for automatic cost optimization
3. **Set up Lambda Provisioned Concurrency** only for critical functions
4. **Use CloudWatch Logs retention policies** to control log storage costs
5. **Monitor and right-size Lambda memory** allocation

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

### Local Testing

Run unit tests
```
pnpm test
Test with local DynamoDB
```
docker run -p 8000:8000 amazon/dynamodb-local
export DYNAMODB_ENDPOINT=http://localhost:8000
pnpm run dev
```

### Integration Testing

Test deployed API
```
curl https://your-api-gateway-url/health
```
Test prompt creation
```
curl -X POST https://your-api-gateway-url/v1/prompts
-H "Content-Type: application/json"
-d '{"name": "test", "template": "Hello {{name}}", "category": "greeting"}'
```

## 🚨 Troubleshooting

### Common Issues

1. **403 Access Denied**
   - Check IAM permissions
   - Verify resource policies
   - Check VPC configuration if using private subnets

2. **Lambda Timeout**
   - Increase timeout in CDK stack
   - Optimize cold start performance
   - Check DynamoDB/S3 connection latency

3. **DynamoDB Throttling**
   - Switch to On-Demand billing
   - Optimize partition key distribution
   - Implement exponential backoff

4. **High Costs**
   - Review CloudWatch cost analysis
   - Optimize Lambda memory allocation
   - Implement S3 lifecycle policies
   - Review DynamoDB read/write patterns

### Debug Commands

Check Lambda logs
```
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/McpPromptsStack"
```
Check DynamoDB table
```
aws dynamodb describe-table --table-name mcp-prompts
```
Check S3 bucket
```
aws s3 ls s3://your-bucket-name --recursive
```
Check SQS queue
```
aws sqs get-queue-attributes --queue-url your-queue-url --attribute-names All
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```
name: Deploy to AWS
on:
push:
branches: [main]

jobs:
deploy:
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v3
- uses: actions/setup-node@v3
with:
node-version: '18'
- run: pnpm install
- run: pnpm run build
- run: pnpm run deploy
env:
AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

```

## 📚 Further Reading

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Lambda Performance Optimization](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [API Gateway Throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
