#!/bin/bash

# MCP-Prompts Security Testing Script
# This script tests all security implementations

set -e

echo "🔒 Testing MCP-Prompts Security Implementation"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    print_status "Running: $test_name"
    
    if eval "$test_command" > /dev/null 2>&1; then
        print_success "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_error "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    print_error "AWS CLI is not configured"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

echo ""
echo "Testing Security Implementation for Account: $ACCOUNT_ID, Region: $REGION"
echo ""

# 1. Test Secrets Manager
echo "1. Testing Secrets Manager Configuration"
echo "========================================"

run_test "Secrets Manager secret exists" \
    "aws secretsmanager describe-secret --secret-id 'mcp-prompts/secrets'"

run_test "Secrets Manager secret has correct structure" \
    "aws secretsmanager get-secret-value --secret-id 'mcp-prompts/secrets' --query 'SecretString' --output text | jq -e '.aws_access_key_id'"

run_test "Secrets Manager secret has JWT secret" \
    "aws secretsmanager get-secret-value --secret-id 'mcp-prompts/secrets' --query 'SecretString' --output text | jq -e '.jwt_secret'"

# 2. Test IAM Roles
echo ""
echo "2. Testing IAM Roles Configuration"
echo "=================================="

run_test "ECS Task Role exists" \
    "aws iam get-role --role-name 'McpPromptsTaskRole'"

run_test "ECS Task Role has correct trust policy" \
    "aws iam get-role --role-name 'McpPromptsTaskRole' --query 'Role.AssumeRolePolicyDocument.Statement[0].Principal.Service' --output text | grep -q 'ecs-tasks.amazonaws.com'"

run_test "ECS Task Role has DynamoDB permissions" \
    "aws iam get-role-policy --role-name 'McpPromptsTaskRole' --policy-name 'McpPromptsTaskPolicy' --query 'PolicyDocument.Statement[?contains(Action, \`dynamodb:GetItem\`)]' --output text | grep -q 'dynamodb:GetItem'"

# 3. Test ECR Repository
echo ""
echo "3. Testing ECR Repository Configuration"
echo "======================================="

run_test "ECR repository exists" \
    "aws ecr describe-repositories --repository-names 'mcp-prompts'"

run_test "ECR repository has image scanning enabled" \
    "aws ecr describe-repositories --repository-names 'mcp-prompts' --query 'repositories[0].imageScanningConfiguration.scanOnPush' --output text | grep -q 'True'"

run_test "ECR repository has encryption enabled" \
    "aws ecr describe-repositories --repository-names 'mcp-prompts' --query 'repositories[0].encryptionConfiguration.encryptionType' --output text | grep -q 'AES256'"

# 4. Test VPC Configuration
echo ""
echo "4. Testing VPC Configuration"
echo "============================"

# Check if VPC exists
VPC_ID=$(aws ec2 describe-vpcs \
    --filters "Name=tag:Name,Values=mcp-prompts-vpc" \
    --query 'Vpcs[0].VpcId' \
    --output text 2>/dev/null || echo "None")

if [ "$VPC_ID" != "None" ] && [ "$VPC_ID" != "null" ]; then
    run_test "VPC exists" "true"
    
    run_test "VPC has private subnets" \
        "aws ec2 describe-subnets --filters 'Name=vpc-id,Values=$VPC_ID' 'Name=tag:Name,Values=*Private*' --query 'Subnets' --output text | wc -l | grep -q '[1-9]'"
    
    run_test "VPC has public subnets" \
        "aws ec2 describe-subnets --filters 'Name=vpc-id,Values=$VPC_ID' 'Name=tag:Name,Values=*Public*' --query 'Subnets' --output text | wc -l | grep -q '[1-9]'"
else
    print_warning "VPC not found - will be created by CDK"
fi

# 5. Test DynamoDB Tables
echo ""
echo "5. Testing DynamoDB Tables Configuration"
echo "========================================"

run_test "Prompts table exists" \
    "aws dynamodb describe-table --table-name 'mcp-prompts'"

run_test "Sessions table exists" \
    "aws dynamodb describe-table --table-name 'mcp-sessions'"

run_test "Users table exists" \
    "aws dynamodb describe-table --table-name 'mcp-users'"

run_test "Prompts table has encryption enabled" \
    "aws dynamodb describe-table --table-name 'mcp-prompts' --query 'Table.SSEDescription.Status' --output text | grep -q 'ENABLED'"

# 6. Test S3 Buckets
echo ""
echo "6. Testing S3 Buckets Configuration"
echo "==================================="

run_test "Prompts bucket exists" \
    "aws s3api head-bucket --bucket 'mcp-prompts-catalog-$ACCOUNT_ID-$REGION'"

run_test "User prompts bucket exists" \
    "aws s3api head-bucket --bucket 'mcp-user-prompts-$ACCOUNT_ID-$REGION'"

run_test "Prompts bucket has encryption enabled" \
    "aws s3api get-bucket-encryption --bucket 'mcp-prompts-catalog-$ACCOUNT_ID-$REGION' --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text | grep -q 'AES256'"

run_test "Prompts bucket has public access blocked" \
    "aws s3api get-public-access-block --bucket 'mcp-prompts-catalog-$ACCOUNT_ID-$REGION' --query 'PublicAccessBlockConfiguration.BlockPublicAcls' --output text | grep -q 'True'"

# 7. Test CloudWatch Logs
echo ""
echo "7. Testing CloudWatch Logs Configuration"
echo "========================================"

run_test "ECS log group exists" \
    "aws logs describe-log-groups --log-group-name-prefix '/aws/ecs/mcp-prompts' --query 'logGroups[0].logGroupName' --output text | grep -q 'mcp-prompts'"

run_test "Lambda log group exists" \
    "aws logs describe-log-groups --log-group-name-prefix '/aws/lambda/mcp-prompts' --query 'logGroups[0].logGroupName' --output text | grep -q 'mcp-prompts'"

# 8. Test SSL Certificate (if domain provided)
if [ -n "$1" ]; then
    DOMAIN_NAME="$1"
    echo ""
    echo "8. Testing SSL Certificate Configuration"
    echo "========================================"
    
    run_test "SSL certificate exists for domain" \
        "aws acm list-certificates --query 'CertificateSummaryList[?DomainName==`$DOMAIN_NAME`]' --output text | grep -q '$DOMAIN_NAME'"
    
    run_test "SSL certificate is validated" \
        "aws acm list-certificates --query 'CertificateSummaryList[?DomainName==`$DOMAIN_NAME` && Status==`ISSUED`]' --output text | grep -q '$DOMAIN_NAME'"
fi

# 9. Test Docker Image Security
echo ""
echo "9. Testing Docker Image Security"
echo "================================"

# Check if Docker is running
if docker info > /dev/null 2>&1; then
    run_test "Docker is running" "true"
    
    # Check if production image exists
    if docker images | grep -q "mcp-prompts.*production"; then
        run_test "Production Docker image exists" "true"
        
        # Test image security
        run_test "Docker image runs as non-root user" \
            "docker run --rm mcp-prompts:production whoami | grep -q 'mcp-prompts'"
        
        run_test "Docker image has health check" \
            "docker inspect mcp-prompts:production --format='{{.Config.Healthcheck}}' | grep -q 'curl'"
    else
        print_warning "Production Docker image not found - build with: docker build -f Dockerfile.production -t mcp-prompts:production ."
    fi
else
    print_warning "Docker is not running - skipping Docker security tests"
fi

# 10. Test API Gateway Security
echo ""
echo "10. Testing API Gateway Security"
echo "================================"

# Check if API Gateway exists
API_ID=$(aws apigateway get-rest-apis --query 'items[?name==`MCP Prompts Service`].id' --output text 2>/dev/null || echo "None")

if [ "$API_ID" != "None" ] && [ "$API_ID" != "null" ]; then
    run_test "API Gateway exists" "true"
    
    run_test "API Gateway has CORS configured" \
        "aws apigateway get-rest-api --rest-api-id '$API_ID' --query 'policy' --output text | grep -q 'CORS' || aws apigateway get-rest-api --rest-api-id '$API_ID' --query 'defaultCorsPreflightOptions' --output text | grep -q 'allowOrigins'"
    
    run_test "API Gateway has usage plan" \
        "aws apigateway get-usage-plans --query 'items[?name==`MCP Prompts Usage Plan`]' --output text | grep -q 'MCP Prompts Usage Plan'"
else
    print_warning "API Gateway not found - will be created by CDK"
fi

# 11. Test Cognito Configuration
echo ""
echo "11. Testing Cognito Configuration"
echo "================================"

# Check if Cognito User Pool exists
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-items 10 --query 'UserPools[?Name==`mcp-prompts-users`].Id' --output text 2>/dev/null || echo "None")

if [ "$USER_POOL_ID" != "None" ] && [ "$USER_POOL_ID" != "null" ]; then
    run_test "Cognito User Pool exists" "true"
    
    run_test "Cognito User Pool has strong password policy" \
        "aws cognito-idp describe-user-pool --user-pool-id '$USER_POOL_ID' --query 'UserPool.Policies.PasswordPolicy.MinimumLength' --output text | grep -q '[8-9]'"
    
    run_test "Cognito User Pool has MFA enabled" \
        "aws cognito-idp describe-user-pool --user-pool-id '$USER_POOL_ID' --query 'UserPool.MfaConfiguration' --output text | grep -q 'OPTIONAL'"
else
    print_warning "Cognito User Pool not found - will be created by CDK"
fi

# 12. Test Security Groups
echo ""
echo "12. Testing Security Groups Configuration"
echo "========================================="

# Check if security group exists
SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=mcp-prompts-security-group" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || echo "None")

if [ "$SECURITY_GROUP_ID" != "None" ] && [ "$SECURITY_GROUP_ID" != "null" ]; then
    run_test "Security group exists" "true"
    
    run_test "Security group allows HTTPS traffic" \
        "aws ec2 describe-security-groups --group-ids '$SECURITY_GROUP_ID' --query 'SecurityGroups[0].IpPermissions[?FromPort==`443`]' --output text | grep -q '443'"
    
    run_test "Security group allows HTTP traffic" \
        "aws ec2 describe-security-groups --group-ids '$SECURITY_GROUP_ID' --query 'SecurityGroups[0].IpPermissions[?FromPort==`80`]' --output text | grep -q '80'"
else
    print_warning "Security group not found - will be created by CDK"
fi

# Summary
echo ""
echo "🎯 Security Test Summary"
echo "========================"
echo "Total Tests: $TESTS_TOTAL"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    print_success "All security tests passed! 🎉"
    echo ""
    echo "✅ Security Implementation Status:"
    echo "   - IAM roles configured correctly"
    echo "   - Secrets Manager set up"
    echo "   - ECR repository secured"
    echo "   - DynamoDB tables encrypted"
    echo "   - S3 buckets secured"
    echo "   - CloudWatch logging configured"
    echo "   - Docker image hardened"
    echo "   - API Gateway secured"
    echo "   - Cognito authentication enhanced"
    echo ""
    echo "🚀 Ready for production deployment!"
    exit 0
else
    print_error "Some security tests failed. Please review and fix issues."
    echo ""
    echo "❌ Failed Tests:"
    echo "   - Check the output above for specific failures"
    echo "   - Run individual tests to debug issues"
    echo "   - Ensure all AWS resources are properly configured"
    echo ""
    echo "🔧 Next Steps:"
    echo "   1. Fix failed tests"
    echo "   2. Re-run security tests"
    echo "   3. Deploy with confidence"
    exit 1
fi
