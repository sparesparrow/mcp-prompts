#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { McpPromptsStack } from '../lib/mcp-prompts-stack';

const app = new cdk.App();

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
