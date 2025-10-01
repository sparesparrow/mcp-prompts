#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { McpPromptsStack } from '../lib/mcp-prompts-stack';
import { McpPromptsSecurityStack } from '../lib/mcp-prompts-security-stack';

const app = new cdk.App();

// Original stack for backward compatibility
new McpPromptsStack(app, 'McpPromptsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  tags: {
    Project: 'MCP-Prompts',
    Environment: process.env.NODE_ENV || 'development'
  }
});

// Enhanced security stack
const securityStack = new McpPromptsSecurityStack(app, 'McpPromptsSecurityStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  domainName: process.env.DOMAIN_NAME,
  certificateArn: process.env.CERTIFICATE_ARN,
  hostedZoneId: process.env.HOSTED_ZONE_ID,
  tags: {
    Project: 'MCP-Prompts',
    Environment: 'production',
    Security: 'enhanced'
  }
});

// Add dependency if needed
// securityStack.addDependency(originalStack);
