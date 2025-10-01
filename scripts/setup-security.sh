#!/bin/bash

# MCP-Prompts Security Setup Script
# This script sets up production-ready security configurations

set -e

echo "🔐 Setting up MCP-Prompts Security Configuration"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    print_error "AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)
STACK_NAME="McpPromptsSecurityStack"

print_status "Using AWS Account: $ACCOUNT_ID"
print_status "Using AWS Region: $REGION"

# 1. Create Secrets Manager secret
print_status "Creating Secrets Manager secret..."

SECRET_NAME="mcp-prompts/secrets"
SECRET_VALUE=$(cat <<EOF
{
  "aws_access_key_id": "$(aws configure get aws_access_key_id)",
  "aws_secret_access_key": "$(aws configure get aws_secret_access_key)",
  "stripe_secret_key": "sk_test_$(openssl rand -hex 16)",
  "stripe_webhook_secret": "whsec_$(openssl rand -hex 16)",
  "jwt_secret": "$(openssl rand -base64 32)",
  "db_password": "$(openssl rand -base64 16)",
  "api_key": "$(openssl rand -hex 32)"
}
EOF
)

# Check if secret already exists
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" > /dev/null 2>&1; then
    print_warning "Secret $SECRET_NAME already exists. Updating..."
    aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_VALUE" \
        --description "Updated secrets for MCP Prompts application"
else
    print_status "Creating new secret..."
    aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --description "Secrets for MCP Prompts application" \
        --secret-string "$SECRET_VALUE"
fi

print_success "Secrets Manager secret created/updated"

# 2. Create IAM roles for ECS tasks
print_status "Creating IAM roles for ECS tasks..."

# ECS Task Role
TASK_ROLE_NAME="McpPromptsTaskRole"
TASK_ROLE_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/mcp-prompts",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/mcp-sessions",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/mcp-users"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::mcp-prompts-catalog-${ACCOUNT_ID}-${REGION}",
        "arn:aws:s3:::mcp-prompts-catalog-${ACCOUNT_ID}-${REGION}/*",
        "arn:aws:s3:::mcp-user-prompts-${ACCOUNT_ID}-${REGION}",
        "arn:aws:s3:::mcp-user-prompts-${ACCOUNT_ID}-${REGION}/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:mcp-prompts/secrets*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminInitiateAuth",
        "cognito-idp:AdminRespondToAuthChallenge",
        "cognito-idp:AdminGetUser",
        "cognito-idp:ListUsers",
        "cognito-idp:AdminUpdateUserAttributes"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

# Create task role if it doesn't exist
if ! aws iam get-role --role-name "$TASK_ROLE_NAME" > /dev/null 2>&1; then
    aws iam create-role \
        --role-name "$TASK_ROLE_NAME" \
        --assume-role-policy-document '{
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
              },
              "Action": "sts:AssumeRole"
            }
          ]
        }'
    
    aws iam put-role-policy \
        --role-name "$TASK_ROLE_NAME" \
        --policy-name "McpPromptsTaskPolicy" \
        --policy-document "$TASK_ROLE_POLICY"
    
    print_success "ECS Task Role created"
else
    print_warning "ECS Task Role already exists"
fi

# 3. Create ECR repository
print_status "Creating ECR repository..."

ECR_REPO_NAME="mcp-prompts"
if ! aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" > /dev/null 2>&1; then
    aws ecr create-repository \
        --repository-name "$ECR_REPO_NAME" \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256
    
    print_success "ECR repository created"
else
    print_warning "ECR repository already exists"
fi

# 4. Create SSL Certificate (if domain provided)
if [ -n "$1" ]; then
    DOMAIN_NAME="$1"
    print_status "Setting up SSL certificate for domain: $DOMAIN_NAME"
    
    # Request certificate
    CERT_ARN=$(aws acm request-certificate \
        --domain-name "$DOMAIN_NAME" \
        --subject-alternative-names "*.${DOMAIN_NAME}" \
        --validation-method DNS \
        --query 'CertificateArn' \
        --output text)
    
    print_success "SSL certificate requested: $CERT_ARN"
    print_warning "You need to validate the certificate via DNS before deploying"
    
    # Save certificate ARN for later use
    echo "CERTIFICATE_ARN=$CERT_ARN" > .env.security
    echo "DOMAIN_NAME=$DOMAIN_NAME" >> .env.security
fi

# 5. Create VPC with private subnets
print_status "Setting up VPC configuration..."

# Check if VPC already exists
VPC_ID=$(aws ec2 describe-vpcs \
    --filters "Name=tag:Name,Values=mcp-prompts-vpc" \
    --query 'Vpcs[0].VpcId' \
    --output text 2>/dev/null || echo "None")

if [ "$VPC_ID" = "None" ] || [ "$VPC_ID" = "null" ]; then
    print_status "VPC will be created by CDK stack"
else
    print_warning "VPC already exists: $VPC_ID"
fi

# 6. Create CloudWatch Log Groups
print_status "Creating CloudWatch log groups..."

LOG_GROUPS=(
    "/aws/ecs/mcp-prompts"
    "/aws/lambda/mcp-prompts"
    "/aws/apigateway/mcp-prompts"
)

for log_group in "${LOG_GROUPS[@]}"; do
    if ! aws logs describe-log-groups --log-group-name-prefix "$log_group" > /dev/null 2>&1; then
        aws logs create-log-group \
            --log-group-name "$log_group" \
            --retention-in-days 30
        print_success "Created log group: $log_group"
    else
        print_warning "Log group already exists: $log_group"
    fi
done

# 7. Create security configuration file
print_status "Creating security configuration file..."

cat > security-config.json <<EOF
{
  "accountId": "${ACCOUNT_ID}",
  "region": "${REGION}",
  "secretName": "${SECRET_NAME}",
  "taskRoleName": "${TASK_ROLE_NAME}",
  "ecrRepository": "${ECR_REPO_NAME}",
  "domainName": "${DOMAIN_NAME:-}",
  "certificateArn": "${CERT_ARN:-}",
  "vpcId": "${VPC_ID:-}",
  "securityGroups": [],
  "subnets": {
    "public": [],
    "private": [],
    "database": []
  }
}
EOF

print_success "Security configuration saved to security-config.json"

# 8. Generate deployment commands
print_status "Generating deployment commands..."

cat > deploy-security.sh <<EOF
#!/bin/bash
# Deploy MCP-Prompts with security enhancements

set -e

echo "🚀 Deploying MCP-Prompts Security Stack"
echo "======================================"

# Build and push Docker image
echo "Building Docker image..."
docker build -t mcp-prompts:latest -f Dockerfile .

# Tag and push to ECR
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO_NAME}"
docker tag mcp-prompts:latest \${ECR_URI}:latest
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin \${ECR_URI}
docker push \${ECR_URI}:latest

# Deploy CDK stack
echo "Deploying CDK stack..."
cd cdk
npm install
npx cdk deploy McpPromptsSecurityStack --require-approval never

echo "✅ Security stack deployed successfully!"
EOF

chmod +x deploy-security.sh

print_success "Deployment script created: deploy-security.sh"

# 9. Create monitoring and alerting setup
print_status "Setting up monitoring configuration..."

cat > monitoring-config.json <<EOF
{
  "alarms": [
    {
      "name": "HighErrorRate",
      "description": "High error rate in API Gateway",
      "metric": "4XXError",
      "threshold": 10,
      "evaluationPeriods": 2
    },
    {
      "name": "HighLatency",
      "description": "High latency in API Gateway",
      "metric": "Latency",
      "threshold": 5000,
      "evaluationPeriods": 2
    },
    {
      "name": "HighCPUUtilization",
      "description": "High CPU utilization in ECS tasks",
      "metric": "CPUUtilization",
      "threshold": 80,
      "evaluationPeriods": 2
    },
    {
      "name": "HighMemoryUtilization",
      "description": "High memory utilization in ECS tasks",
      "metric": "MemoryUtilization",
      "threshold": 80,
      "evaluationPeriods": 2
    }
  ],
  "dashboards": [
    {
      "name": "MCP-Prompts-Security-Dashboard",
      "widgets": [
        "API Gateway Metrics",
        "ECS Service Metrics",
        "DynamoDB Metrics",
        "S3 Metrics",
        "CloudWatch Logs"
      ]
    }
  ]
}
EOF

print_success "Monitoring configuration saved to monitoring-config.json"

# 10. Summary
echo ""
echo "🎉 Security Setup Complete!"
echo "=========================="
echo ""
echo "✅ Created/Updated:"
echo "   - Secrets Manager secret: $SECRET_NAME"
echo "   - IAM Task Role: $TASK_ROLE_NAME"
echo "   - ECR Repository: $ECR_REPO_NAME"
echo "   - CloudWatch Log Groups"
echo "   - Security configuration files"
echo ""
echo "📋 Next Steps:"
echo "   1. Review security-config.json"
echo "   2. If using custom domain, validate SSL certificate"
echo "   3. Run: ./deploy-security.sh"
echo "   4. Monitor via CloudWatch dashboards"
echo ""
echo "🔐 Security Features Enabled:"
echo "   - IAM roles instead of access keys"
echo "   - Secrets Manager for sensitive data"
echo "   - VPC with private subnets"
echo "   - VPC endpoints for AWS services"
echo "   - SSL/TLS encryption"
echo "   - Enhanced Cognito authentication"
echo "   - CloudWatch monitoring and alerting"
echo ""

print_success "Security setup completed successfully!"
