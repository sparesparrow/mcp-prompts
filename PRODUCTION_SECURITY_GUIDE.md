# MCP-Prompts Production Security Guide

**Version**: 3.12.2  
**Date**: October 1, 2025  
**Status**: Production Ready with Enhanced Security

---

## 🔐 Security Overview

This guide covers the implementation of production-ready security enhancements for MCP-Prompts, including:

- ✅ **IAM Roles** instead of access keys
- ✅ **AWS Secrets Manager** for credential storage
- ✅ **TLS/HTTPS** with SSL certificates
- ✅ **API Authentication** with Cognito
- ✅ **VPC Endpoints** for AWS services
- ✅ **Container Security** with non-root users
- ✅ **Encryption** at rest and in transit
- ✅ **Monitoring** and alerting

---

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Required tools
aws --version          # AWS CLI v2+
docker --version       # Docker 20+
node --version         # Node.js 18+
cdk --version          # AWS CDK v2+

# Required permissions
aws sts get-caller-identity
```

### 2. Security Setup

```bash
# Run the security setup script
cd /home/sparrow/projects/AWS/mcp-prompts
./scripts/setup-security.sh [your-domain.com]

# Test security configuration
./scripts/test-security.sh [your-domain.com]
```

### 3. Deploy with Security

```bash
# Build and deploy
./scripts/deploy-security.sh

# Or deploy manually
docker build -f Dockerfile.production -t mcp-prompts:production .
cd cdk && npx cdk deploy McpPromptsSecurityStack
```

---

## 🏗️ Architecture

### Security-Enhanced Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Internet Gateway                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                CloudFront CDN                              │
│  • SSL/TLS Termination                                     │
│  • DDoS Protection                                         │
│  • Geographic Restrictions                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Application Load Balancer                     │
│  • SSL/TLS Termination                                     │
│  • Health Checks                                           │
│  • Access Logs                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  ECS Fargate                               │
│  • Non-root containers                                     │
│  • Secrets from Secrets Manager                            │
│  • IAM roles (no access keys)                             │
│  • Health checks                                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    VPC Endpoints                           │
│  • DynamoDB Gateway Endpoint                               │
│  • S3 Gateway Endpoint                                     │
│  • Secrets Manager Interface Endpoint                      │
│  • CloudWatch Logs Interface Endpoint                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  AWS Services                              │
│  • DynamoDB (encrypted)                                    │
│  • S3 (encrypted, access logs)                             │
│  • Cognito (MFA, strong passwords)                         │
│  • CloudWatch (monitoring, alerting)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Security Components

### 1. IAM Roles & Policies

#### ECS Task Role
```json
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
        "arn:aws:dynamodb:region:account:table/mcp-prompts",
        "arn:aws:dynamodb:region:account:table/mcp-sessions",
        "arn:aws:dynamodb:region:account:table/mcp-users"
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
        "arn:aws:s3:::mcp-prompts-catalog-*",
        "arn:aws:s3:::mcp-user-prompts-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:region:account:secret:mcp-prompts/secrets*"
    }
  ]
}
```

#### ECS Execution Role
- ECS Task Execution Role Policy
- ECR permissions
- CloudWatch Logs permissions
- Secrets Manager permissions

### 2. Secrets Manager

#### Secret Structure
```json
{
  "aws_access_key_id": "AKIA...",
  "aws_secret_access_key": "...",
  "stripe_secret_key": "sk_test_...",
  "stripe_webhook_secret": "whsec_...",
  "jwt_secret": "base64-encoded-secret",
  "db_password": "secure-password",
  "api_key": "api-key-for-external-services"
}
```

#### Access Pattern
```typescript
// In your application
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
const secret = await client.send(new GetSecretValueCommand({
  SecretId: 'mcp-prompts/secrets'
}));
const secrets = JSON.parse(secret.SecretString!);
```

### 3. VPC Configuration

#### VPC Structure
```
VPC (10.0.0.0/16)
├── Public Subnets (10.0.1.0/24, 10.0.2.0/24)
│   └── Load Balancer, NAT Gateway
├── Private Subnets (10.0.10.0/24, 10.0.20.0/24)
│   └── ECS Tasks, Lambda Functions
└── Database Subnets (10.0.100.0/24, 10.0.200.0/24)
    └── RDS, ElastiCache (if needed)
```

#### VPC Endpoints
- **DynamoDB Gateway Endpoint**: `com.amazonaws.region.dynamodb`
- **S3 Gateway Endpoint**: `com.amazonaws.region.s3`
- **Secrets Manager Interface Endpoint**: `com.amazonaws.region.secretsmanager`
- **CloudWatch Logs Interface Endpoint**: `com.amazonaws.region.logs`
- **ECR Interface Endpoint**: `com.amazonaws.region.ecr.dkr`
- **ECR Docker Interface Endpoint**: `com.amazonaws.region.ecr.api`

### 4. Container Security

#### Dockerfile.production Features
```dockerfile
# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp-prompts -u 1001 -G nodejs

# Security updates
RUN apk update && apk upgrade

# Minimal base image
FROM node:20-alpine

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Proper signal handling
ENTRYPOINT ["dumb-init", "--"]
```

#### Security Best Practices
- ✅ Non-root user execution
- ✅ Minimal base image (Alpine Linux)
- ✅ Security updates applied
- ✅ No sensitive data in image
- ✅ Health checks configured
- ✅ Proper signal handling
- ✅ Read-only filesystem (where possible)

### 5. Encryption

#### At Rest
- **DynamoDB**: AWS managed encryption (AES-256)
- **S3**: Server-side encryption (AES-256)
- **Secrets Manager**: AWS managed encryption
- **EBS Volumes**: EBS encryption

#### In Transit
- **API Gateway**: TLS 1.2+
- **CloudFront**: TLS 1.2+
- **Load Balancer**: TLS 1.2+
- **VPC Endpoints**: TLS 1.2+

### 6. Authentication & Authorization

#### Cognito User Pool Configuration
```typescript
const userPool = new cognito.UserPool(this, 'UserPool', {
  passwordPolicy: {
    minLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true
  },
  mfa: cognito.Mfa.OPTIONAL,
  mfaSecondFactor: {
    sms: true,
    otp: true
  },
  advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED
});
```

#### JWT Token Configuration
- **Access Token**: 1 hour validity
- **Refresh Token**: 30 days validity
- **ID Token**: 1 hour validity
- **Algorithm**: RS256 (RSA with SHA-256)

### 7. Monitoring & Alerting

#### CloudWatch Alarms
```typescript
// High Error Rate
new cloudwatch.Alarm(this, 'HighErrorRate', {
  metric: api.metricClientError(),
  threshold: 10,
  evaluationPeriods: 2
});

// High Latency
new cloudwatch.Alarm(this, 'HighLatency', {
  metric: api.metricLatency(),
  threshold: 5000, // 5 seconds
  evaluationPeriods: 2
});

// High CPU Utilization
new cloudwatch.Alarm(this, 'HighCPU', {
  metric: service.metricCpuUtilization(),
  threshold: 80,
  evaluationPeriods: 2
});
```

#### Log Groups
- `/aws/ecs/mcp-prompts` - ECS application logs
- `/aws/lambda/mcp-prompts` - Lambda function logs
- `/aws/apigateway/mcp-prompts` - API Gateway logs
- `/aws/cloudfront/mcp-prompts` - CloudFront logs

---

## 🚀 Deployment Process

### 1. Pre-deployment Checklist

```bash
# 1. Verify AWS credentials
aws sts get-caller-identity

# 2. Check required tools
docker --version
node --version
cdk --version

# 3. Run security tests
./scripts/test-security.sh

# 4. Build production image
docker build -f Dockerfile.production -t mcp-prompts:production .
```

### 2. Deploy Security Stack

```bash
# Option 1: Automated deployment
./scripts/setup-security.sh your-domain.com
./scripts/deploy-security.sh

# Option 2: Manual deployment
cd cdk
npm install
npx cdk deploy McpPromptsSecurityStack --require-approval never
```

### 3. Post-deployment Verification

```bash
# 1. Check all resources
./scripts/test-security.sh your-domain.com

# 2. Test API endpoints
curl https://your-domain.com/health
curl https://your-domain.com/v1/prompts

# 3. Check CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix '/aws/ecs/mcp-prompts'

# 4. Verify SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

---

## 🔍 Security Testing

### Automated Testing

```bash
# Run comprehensive security tests
./scripts/test-security.sh your-domain.com

# Test specific components
aws secretsmanager get-secret-value --secret-id 'mcp-prompts/secrets'
aws iam get-role --role-name 'McpPromptsTaskRole'
aws ecr describe-repositories --repository-names 'mcp-prompts'
```

### Manual Testing

#### 1. Container Security
```bash
# Test non-root user
docker run --rm mcp-prompts:production whoami
# Should return: mcp-prompts

# Test health check
docker run -d --name test mcp-prompts:production
docker exec test curl -f http://localhost:3003/health
docker stop test && docker rm test
```

#### 2. API Security
```bash
# Test HTTPS redirect
curl -I http://your-domain.com/health
# Should return: 301 Moved Permanently

# Test CORS headers
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS https://your-domain.com/v1/prompts
```

#### 3. Authentication
```bash
# Test protected endpoints
curl https://your-domain.com/users/me
# Should return: 401 Unauthorized

# Test with valid token
curl -H "Authorization: Bearer $JWT_TOKEN" \
     https://your-domain.com/users/me
# Should return: 200 OK with user data
```

---

## 📊 Monitoring & Maintenance

### CloudWatch Dashboards

#### Security Dashboard
- API Gateway error rates
- ECS service health
- DynamoDB throttling
- S3 access patterns
- CloudWatch Logs errors

#### Performance Dashboard
- Response times
- Throughput
- Resource utilization
- Cost metrics

### Alerting

#### Critical Alerts
- High error rate (>10%)
- High latency (>5s)
- Service down
- Security group changes
- IAM policy changes

#### Warning Alerts
- High CPU utilization (>80%)
- High memory utilization (>80%)
- Low disk space
- Certificate expiration (30 days)

### Maintenance Tasks

#### Daily
- Check CloudWatch alarms
- Review security logs
- Monitor resource usage

#### Weekly
- Update security patches
- Review access logs
- Check certificate status

#### Monthly
- Rotate secrets
- Review IAM permissions
- Update dependencies
- Security audit

---

## 🛡️ Security Best Practices

### 1. Access Control
- Use IAM roles instead of access keys
- Implement least privilege principle
- Regular access reviews
- Multi-factor authentication

### 2. Data Protection
- Encrypt data at rest and in transit
- Use AWS managed keys
- Regular backup verification
- Data classification

### 3. Network Security
- VPC with private subnets
- Security groups with minimal rules
- VPC endpoints for AWS services
- DDoS protection

### 4. Application Security
- Regular security updates
- Container image scanning
- Dependency vulnerability scanning
- Secure coding practices

### 5. Monitoring & Logging
- Comprehensive logging
- Real-time monitoring
- Automated alerting
- Regular security reviews

---

## 🚨 Incident Response

### Security Incident Checklist

1. **Immediate Response**
   - Isolate affected resources
   - Preserve evidence
   - Notify stakeholders

2. **Investigation**
   - Review CloudWatch logs
   - Check IAM access logs
   - Analyze network traffic

3. **Containment**
   - Update security groups
   - Rotate compromised credentials
   - Apply security patches

4. **Recovery**
   - Restore from backups
   - Verify system integrity
   - Update monitoring

5. **Post-Incident**
   - Document lessons learned
   - Update security procedures
   - Conduct security review

---

## 📚 Additional Resources

### AWS Security Documentation
- [AWS Security Best Practices](https://aws.amazon.com/security/security-resources/)
- [AWS Well-Architected Security Pillar](https://aws.amazon.com/architecture/well-architected/)
- [AWS Security Checklist](https://aws.amazon.com/security/security-resources/)

### Compliance
- SOC 2 Type II
- ISO 27001
- PCI DSS (if handling payments)
- GDPR (if handling EU data)

### Tools
- AWS Security Hub
- AWS Config
- AWS CloudTrail
- AWS GuardDuty
- AWS Inspector

---

## ✅ Security Checklist

### Pre-Production
- [ ] IAM roles configured
- [ ] Secrets Manager set up
- [ ] VPC with private subnets
- [ ] VPC endpoints configured
- [ ] SSL certificate valid
- [ ] Container security hardened
- [ ] Encryption enabled
- [ ] Monitoring configured
- [ ] Security tests passing

### Production
- [ ] All resources deployed
- [ ] Health checks passing
- [ ] SSL certificate valid
- [ ] API endpoints responding
- [ ] Authentication working
- [ ] Monitoring active
- [ ] Alerts configured
- [ ] Documentation updated

### Post-Production
- [ ] Security monitoring active
- [ ] Regular backups
- [ ] Access reviews scheduled
- [ ] Incident response plan ready
- [ ] Security training completed

---

**Security Guide Version**: 1.0  
**Last Updated**: October 1, 2025  
**Next Review**: November 1, 2025

---

*This guide provides comprehensive security implementation for MCP-Prompts. For questions or updates, please refer to the project documentation or contact the security team.*
