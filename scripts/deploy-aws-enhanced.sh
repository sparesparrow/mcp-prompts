#!/bin/bash

set -e

echo "☁️  Deploying MCP-Prompts to AWS (Enhanced)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STORAGE_TYPE="aws"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-default}"
STACK_NAME="${STACK_NAME:-McpPromptsStack}"
ENVIRONMENT="${ENVIRONMENT:-production}"
LOG_LEVEL="${LOG_LEVEL:-info}"

echo -e "${BLUE}🔧 Configuration:${NC}"
echo -e "  Storage Type: ${YELLOW}$STORAGE_TYPE${NC}"
echo -e "  AWS Region: ${YELLOW}$AWS_REGION${NC}"
echo -e "  AWS Profile: ${YELLOW}$AWS_PROFILE${NC}"
echo -e "  Stack Name: ${YELLOW}$STACK_NAME${NC}"
echo -e "  Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check CDK
if ! command -v cdk &> /dev/null; then
    echo -e "${YELLOW}⚠️  AWS CDK not found. Installing...${NC}"
    npm install -g aws-cdk
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install it first.${NC}"
    exit 1
fi

# Check PNPM
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠️  PNPM not found. Installing...${NC}"
    npm install -g pnpm
fi

# Verify AWS credentials
echo "🔐 Verifying AWS credentials..."
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure'${NC}"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)
echo -e "${GREEN}✅ AWS Account: $AWS_ACCOUNT${NC}"
echo -e "${GREEN}✅ AWS Region: $AWS_REGION${NC}"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build the project
echo "🔨 Building project..."
pnpm run build

# Build Lambda layer
echo "📦 Creating Lambda layer..."
mkdir -p layers/common/nodejs
cp package.json layers/common/nodejs/
cd layers/common/nodejs
npm install --production
cd ../../..

# CDK deployment
echo "🏗️  Deploying infrastructure with CDK..."
cd cdk

# Install CDK dependencies
pnpm install

# Bootstrap CDK (if not already done)
echo "🏗️  Bootstrapping CDK..."
cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION --profile "$AWS_PROFILE"

# Deploy stacks
echo "🚀 Deploying CDK stacks..."
cdk deploy --all --require-approval never --profile "$AWS_PROFILE"

# Get outputs
echo "📋 Getting deployment outputs..."
API_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
    --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
    --output text)

S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
    --output text)

DYNAMODB_TABLE=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBTableName`].OutputValue' \
    --output text)

cd ..

# Get SQS Queue URL
SQS_QUEUE_URL=$(aws sqs get-queue-url \
    --queue-name mcp-prompts-processing \
    --profile "$AWS_PROFILE" \
    --query 'QueueUrl' \
    --output text)

# Populate sample data
echo "📝 Populating sample data..."
cat > ./scripts/populate-aws-sample-data.js <<EOF
#!/usr/bin/env node

const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const fs = require('fs');
const path = require('path');

const client = new DynamoDBClient({ 
    region: '$AWS_REGION',
    ...(process.env.AWS_PROFILE && { credentials: require('@aws-sdk/credential-providers').fromIni({ profile: '$AWS_PROFILE' }) })
});
const tableName = '$DYNAMODB_TABLE';

async function populateSampleData() {
  try {
    const sampleDataPath = path.join(__dirname, '..', 'data', 'sample-prompts.json');
    const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
    
    console.log(\`Loading \${sampleData.prompts.length} sample prompts into DynamoDB...\`);
    
    for (const promptData of sampleData.prompts) {
      const item = marshall({
        id: promptData.id,
        version: 'latest',
        name: promptData.name,
        description: promptData.description || promptData.name,
        template: promptData.content || promptData.template,
        category: promptData.category || 'general',
        tags: promptData.tags || [],
        variables: promptData.variables || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_latest: 'true',
        metadata: promptData.metadata || {}
      });

      const command = new PutItemCommand({
        TableName: tableName,
        Item: item
      });

      await client.send(command);
      console.log(\`✅ Added prompt: \${promptData.name}\`);
    }
    
    console.log('🎉 Successfully populated DynamoDB with sample prompts!');
  } catch (error) {
    console.error('❌ Error populating sample data:', error);
    process.exit(1);
  }
}

populateSampleData();
EOF

chmod +x ./scripts/populate-aws-sample-data.js
AWS_PROFILE="$AWS_PROFILE" node ./scripts/populate-aws-sample-data.js

# Create backup script
echo "💾 Creating backup script..."
cat > ./scripts/backup-aws.sh <<EOF
#!/bin/bash
BACKUP_DIR="./data/backups/aws"
BACKUP_FILE="\$BACKUP_DIR/aws-backup-\$(date +%Y%m%d-%H%M%S)"
mkdir -p "\$BACKUP_DIR"

echo "Creating AWS backup..."

# Backup DynamoDB table
echo "📊 Backing up DynamoDB table..."
aws dynamodb create-backup \
    --table-name $DYNAMODB_TABLE \
    --backup-name "mcp-prompts-backup-\$(date +%Y%m%d-%H%M%S)" \
    --profile $AWS_PROFILE

# Export DynamoDB data
echo "📤 Exporting DynamoDB data..."
aws dynamodb scan \
    --table-name $DYNAMODB_TABLE \
    --profile $AWS_PROFILE \
    --output json > "\$BACKUP_FILE-dynamodb.json"

# Backup S3 bucket
echo "🪣 Backing up S3 bucket..."
aws s3 sync s3://$S3_BUCKET "\$BACKUP_FILE-s3/" --profile $AWS_PROFILE

echo "Backup completed: \$BACKUP_FILE"
EOF

chmod +x ./scripts/backup-aws.sh

# Create monitoring script
echo "📊 Creating monitoring script..."
cat > ./scripts/monitor-aws.sh <<EOF
#!/bin/bash
echo "📊 MCP Prompts AWS Monitor"
echo "========================="
echo "AWS Account: $AWS_ACCOUNT"
echo "AWS Region: $AWS_REGION"
echo "Stack Name: $STACK_NAME"
echo ""
echo "🔌 Service Status:"
echo "API Gateway: $API_URL"
echo "CloudFront: $CLOUDFRONT_URL"
echo "S3 Bucket: $S3_BUCKET"
echo "DynamoDB Table: $DYNAMODB_TABLE"
echo "SQS Queue: $SQS_QUEUE_URL"
echo ""
echo "📈 DynamoDB Statistics:"
aws dynamodb describe-table \
    --table-name $DYNAMODB_TABLE \
    --profile $AWS_PROFILE \
    --query 'Table.{ItemCount:ItemCount,TableSizeBytes:TableSizeBytes,Status:TableStatus}' \
    --output table
echo ""
echo "🪣 S3 Bucket Statistics:"
aws s3 ls s3://$S3_BUCKET --recursive --summarize --profile $AWS_PROFILE
echo ""
echo "📊 CloudWatch Metrics (last 24h):"
aws cloudwatch get-metric-statistics \
    --namespace AWS/ApiGateway \
    --metric-name Count \
    --dimensions Name=ApiName,Value=McpPromptsApi \
    --start-time \$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics Sum \
    --profile $AWS_PROFILE \
    --output table
EOF

chmod +x ./scripts/monitor-aws.sh

# Create cleanup script
echo "🧹 Creating cleanup script..."
cat > ./scripts/cleanup-aws.sh <<EOF
#!/bin/bash
echo "🧹 Cleaning up AWS resources..."
echo "This will delete the entire CloudFormation stack and all associated resources."
echo "Are you sure? (y/N)"
read -r response
if [[ "\$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Deleting CloudFormation stack..."
    aws cloudformation delete-stack --stack-name $STACK_NAME --profile $AWS_PROFILE
    echo "Stack deletion initiated. Check AWS Console for progress."
else
    echo "Cleanup cancelled."
fi
EOF

chmod +x ./scripts/cleanup-aws.sh

# Create environment file
echo "⚙️  Creating environment file..."
cat > .env.aws <<EOF
# MCP Prompts AWS Configuration
STORAGE_TYPE=aws
AWS_REGION=$AWS_REGION
AWS_PROFILE=$AWS_PROFILE
PROMPTS_TABLE=$DYNAMODB_TABLE
PROMPTS_BUCKET=$S3_BUCKET
PROCESSING_QUEUE=$SQS_QUEUE_URL
API_URL=$API_URL
CLOUDFRONT_URL=$CLOUDFRONT_URL
LOG_LEVEL=$LOG_LEVEL
NODE_ENV=production
EOF

# Create health check script
echo "🏥 Creating health check script..."
cat > ./scripts/health-check-aws.sh <<EOF
#!/bin/bash
echo "🏥 AWS Health Check"
echo "=================="

# Check API Gateway
echo "🔌 Testing API Gateway..."
if curl -s "$API_URL/health" | grep -q "healthy"; then
    echo "✅ API Gateway: Healthy"
else
    echo "❌ API Gateway: Unhealthy"
fi

# Check DynamoDB
echo "📊 Testing DynamoDB..."
if aws dynamodb describe-table --table-name $DYNAMODB_TABLE --profile $AWS_PROFILE &> /dev/null; then
    echo "✅ DynamoDB: Healthy"
else
    echo "❌ DynamoDB: Unhealthy"
fi

# Check S3
echo "🪣 Testing S3..."
if aws s3 ls s3://$S3_BUCKET --profile $AWS_PROFILE &> /dev/null; then
    echo "✅ S3: Healthy"
else
    echo "❌ S3: Unhealthy"
fi

# Check SQS
echo "📨 Testing SQS..."
if aws sqs get-queue-attributes --queue-url $SQS_QUEUE_URL --profile $AWS_PROFILE &> /dev/null; then
    echo "✅ SQS: Healthy"
else
    echo "❌ SQS: Unhealthy"
fi
EOF

chmod +x ./scripts/health-check-aws.sh

echo ""
echo -e "${GREEN}🎉 AWS Enhanced Deployment Completed!${NC}"
echo ""
echo -e "${GREEN}📊 Deployment Summary:${NC}"
echo -e "  Storage Type: ${YELLOW}AWS Services${NC}"
echo -e "  AWS Account: ${YELLOW}$AWS_ACCOUNT${NC}"
echo -e "  AWS Region: ${YELLOW}$AWS_REGION${NC}"
echo -e "  Stack Name: ${YELLOW}$STACK_NAME${NC}"
echo -e "  API Gateway URL: ${YELLOW}$API_URL${NC}"
echo -e "  CloudFront URL: ${YELLOW}$CLOUDFRONT_URL${NC}"
echo -e "  S3 Bucket: ${YELLOW}$S3_BUCKET${NC}"
echo -e "  DynamoDB Table: ${YELLOW}$DYNAMODB_TABLE${NC}"
echo -e "  SQS Queue: ${YELLOW}$SQS_QUEUE_URL${NC}"
echo ""
echo -e "${GREEN}🚀 Start Commands:${NC}"
echo -e "  CLI:         ${YELLOW}AWS_REGION=$AWS_REGION npx @sparesparrow/mcp-prompts list${NC}"
echo -e "  HTTP Server: ${YELLOW}AWS_REGION=$AWS_REGION MODE=http node dist/index.js${NC}"
echo -e "  MCP Server:  ${YELLOW}AWS_REGION=$AWS_REGION MODE=mcp node dist/index.js${NC}"
echo ""
echo -e "${GREEN}🔧 Management Commands:${NC}"
echo -e "  Backup:      ${YELLOW}./scripts/backup-aws.sh${NC}"
echo -e "  Monitor:     ${YELLOW}./scripts/monitor-aws.sh${NC}"
echo -e "  Health Check: ${YELLOW}./scripts/health-check-aws.sh${NC}"
echo -e "  Cleanup:     ${YELLOW}./scripts/cleanup-aws.sh${NC}"
echo ""
echo -e "${GREEN}🔗 Useful Links:${NC}"
echo -e "  Health Check:    ${YELLOW}$API_URL/health${NC}"
echo -e "  MCP Capabilities: ${YELLOW}$API_URL/mcp${NC}"
echo -e "  API Docs:        ${YELLOW}$API_URL/v1/prompts${NC}"
echo -e "  CloudFront:      ${YELLOW}$CLOUDFRONT_URL${NC}"
echo ""
echo -e "${GREEN}📝 Next Steps:${NC}"
echo "1. Test the API: curl $API_URL/health"
echo "2. Set up CloudWatch alarms for monitoring"
echo "3. Configure AWS WAF for security"
echo "4. Set up automated backups"
echo "5. Configure cost monitoring and budgets"
echo "6. Set up CI/CD pipeline for automated deployments"
