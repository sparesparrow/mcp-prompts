#!/bin/bash

set -e

echo "🚀 Deploying MCP-Prompts to AWS"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure'${NC}"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_DEFAULT_REGION:-us-east-1}

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
cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION

# Deploy stacks
echo "🚀 Deploying CDK stacks..."
cdk deploy --all --require-approval never

# Get outputs
echo "📋 Getting deployment outputs..."
API_URL=$(aws cloudformation describe-stacks \
    --stack-name McpPromptsStack \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
    --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name McpPromptsStack \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
    --output text)

S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name McpPromptsStack \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
    --output text)

DYNAMODB_TABLE=$(aws cloudformation describe-stacks \
    --stack-name McpPromptsStack \
    --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBTableName`].OutputValue' \
    --output text)

cd ..

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo -e "${GREEN}📊 Deployment Summary:${NC}"
echo -e "  API Gateway URL: ${YELLOW}$API_URL${NC}"
echo -e "  CloudFront URL:  ${YELLOW}$CLOUDFRONT_URL${NC}"
echo -e "  S3 Bucket:       ${YELLOW}$S3_BUCKET${NC}"
echo -e "  DynamoDB Table:  ${YELLOW}$DYNAMODB_TABLE${NC}"
echo ""
echo -e "${GREEN}🔗 Useful Links:${NC}"
echo -e "  Health Check:    ${YELLOW}$API_URL/health${NC}"
echo -e "  MCP Capabilities: ${YELLOW}$API_URL/mcp${NC}"
echo -e "  API Docs:        ${YELLOW}$API_URL/v1/prompts${NC}"
echo ""
echo -e "${GREEN}📝 Next Steps:${NC}"
echo "1. Test the API: curl $API_URL/health"
echo "2. Sync catalog: curl -X POST $API_URL/admin/sync-catalog"
echo "3. Configure monitoring dashboards in CloudWatch"
echo "4. Set up CI/CD pipeline for automated deployments"
echo ""
echo -e "${YELLOW}💡 Pro Tips:${NC}"
echo "- Monitor costs in AWS Cost Explorer"
echo "- Set up CloudWatch alarms for critical metrics"
echo "- Use AWS X-Ray for distributed tracing"
echo "- Enable AWS Config for compliance monitoring"
