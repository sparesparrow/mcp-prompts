#!/bin/bash

# Comprehensive Testing Script for MCP Prompts AWS Deployment
# This script tests all major functionalities: API endpoints, CLI commands, and AWS integrations

set -e  # Exit on any error

# Configuration
API_URL="https://jaqwv7shwc.execute-api.eu-north-1.amazonaws.com/prod"  # Actual API Gateway URL
API_KEY="o68POXdCOI4ud9jVMOmvY4yg3NJlJdtw8J4sH3up"  # Replace with actual API key
AWS_REGION="eu-north-1"
PACKAGE_NAME="@sparesparrow/mcp-prompts@3.10.0"

echo "=== Starting Comprehensive Testing ==="

# Function to make authenticated API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    echo "Testing $method $endpoint"
    if [ "$method" = "GET" ]; then
        curl -X $method -H "x-api-key: $API_KEY" -H "Content-Type: application/json" "$API_URL$endpoint" -w "\nStatus: %{http_code}\n"
    else
        curl -X $method -H "x-api-key: $API_KEY" -H "Content-Type: application/json" -d "$data" "$API_URL$endpoint" -w "\nStatus: %{http_code}\n"
    fi
    echo "---"
}

# 1. Test Health Endpoint
echo "1. Testing Health Endpoint"
api_call "GET" "/health"

# 2. Test List Prompts (GET /v1/prompts)
echo "2. Testing List Prompts"
api_call "GET" "/v1/prompts"

# 3. Test Create Prompt (POST /v1/prompts)
echo "3. Testing Create Prompt"
CREATE_DATA='{
    "name": "test-prompt",
    "description": "A test prompt for comprehensive testing",
    "template": "This is a {{variable}} test prompt.",
    "category": "test",
    "tags": ["test", "automation"],
    "variables": ["variable"]
}'
api_call "POST" "/v1/prompts" "$CREATE_DATA"

# 4. Test Get Specific Prompt
echo "4. Testing Get Specific Prompt"
api_call "GET" "/v1/prompts/test-prompt"

# 5. Test MCP Endpoint (if applicable)
echo "5. Testing MCP Endpoint"
api_call "GET" "/mcp"

# 6. CLI Tests
echo "6. Testing CLI Commands"

echo "6.1 CLI Version"
npx -y $PACKAGE_NAME --version

echo "6.2 CLI Help"
npx -y $PACKAGE_NAME --help

echo "6.3 CLI List Prompts"
npx -y $PACKAGE_NAME list --storage aws --region $AWS_REGION --api-key $API_KEY

echo "6.4 CLI Get Prompt"
npx -y $PACKAGE_NAME get test-prompt --storage aws --region $AWS_REGION --api-key $API_KEY

echo "6.5 CLI Apply Prompt"
npx -y $PACKAGE_NAME apply test-prompt --variables '{"variable": "applied"}' --storage aws --region $AWS_REGION --api-key $API_KEY

echo "6.6 CLI Search Prompts"
npx -y $PACKAGE_NAME search test --storage aws --region $AWS_REGION --api-key $API_KEY

# 7. AWS Integration Tests
echo "7. Testing AWS Integrations"

echo "7.1 DynamoDB Table Items Count"
aws dynamodb scan --table-name mcp-prompts --region $AWS_REGION --select COUNT

echo "7.2 S3 Bucket Objects"
aws s3 ls s3://mcp-prompts-catalog-875486186075-eu-north-1/ --region $AWS_REGION

echo "7.3 SQS Queue Messages (approximate)"
QUEUE_URL=$(aws sqs get-queue-url --queue-name mcp-prompts-processing --region $AWS_REGION --query 'QueueUrl' --output text)
aws sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names ApproximateNumberOfMessages --region $AWS_REGION

# 8. CloudWatch Logs Check
echo "8. Checking CloudWatch Logs"
LOG_GROUP_NAME="/aws/lambda/mcp-prompts-handler"
aws logs describe-log-streams --log-group-name $LOG_GROUP_NAME --region $AWS_REGION --max-items 1

echo "=== Comprehensive Testing Completed ==="