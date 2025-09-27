#!/bin/bash
set -e

echo "🚨 Creating CloudWatch Alarms..."

# API Gateway 4XX Error Rate Alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "mcp-prompts-api-4xx-errors" \
    --alarm-description "High 4XX error rate on MCP-Prompts API (>5%)" \
    --metric-name "4XXError" \
    --namespace "AWS/ApiGateway" \
    --statistic "Sum" \
    --period 300 \
    --evaluation-periods 3 \
    --threshold 5 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=ApiName,Value=McpPromptsApi \
    --region eu-north-1

# API Gateway 5XX Error Rate Alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "mcp-prompts-api-5xx-errors" \
    --alarm-description "High 5XX error rate on MCP-Prompts API (>1%)" \
    --metric-name "5XXError" \
    --namespace "AWS/ApiGateway" \
    --statistic "Sum" \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 1 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=ApiName,Value=McpPromptsApi \
    --region eu-north-1

# API Gateway High Latency Alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "mcp-prompts-api-high-latency" \
    --alarm-description "API Gateway latency above 2000ms" \
    --metric-name "Latency" \
    --namespace "AWS/ApiGateway" \
    --statistic "Average" \
    --period 300 \
    --evaluation-periods 3 \
    --threshold 2000 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=ApiName,Value=McpPromptsApi \
    --region eu-north-1

# Lambda Function Error Alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "mcp-prompts-lambda-errors" \
    --alarm-description "Lambda function error rate above 5%" \
    --metric-name "Errors" \
    --namespace "AWS/Lambda" \
    --statistic "Sum" \
    --period 300 \
    --evaluation-periods 3 \
    --threshold 5 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=FunctionName,Value=McpPromptsStack-McpServerFunction7B2829A9-oCvEpw3wiMzw \
    --region eu-north-1

# Lambda Function Throttling Alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "mcp-prompts-lambda-throttles" \
    --alarm-description "Lambda function throttling detected" \
    --metric-name "Throttles" \
    --namespace "AWS/Lambda" \
    --statistic "Sum" \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 1 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=FunctionName,Value=McpPromptsStack-McpServerFunction7B2829A9-oCvEpw3wiMzw \
    --region eu-north-1

# DynamoDB Throttling Alarm - Prompts Table
aws cloudwatch put-metric-alarm \
    --alarm-name "mcp-prompts-dynamodb-throttling" \
    --alarm-description "DynamoDB throttling on mcp-prompts table" \
    --metric-name "ThrottledRequests" \
    --namespace "AWS/DynamoDB" \
    --statistic "Sum" \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 1 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=TableName,Value=mcp-prompts \
    --region eu-north-1

# DynamoDB Throttling Alarm - Sessions Table
aws cloudwatch put-metric-alarm \
    --alarm-name "mcp-sessions-dynamodb-throttling" \
    --alarm-description "DynamoDB throttling on mcp-sessions table" \
    --metric-name "ThrottledRequests" \
    --namespace "AWS/DynamoDB" \
    --statistic "Sum" \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 1 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=TableName,Value=mcp-sessions \
    --region eu-north-1

# High Duration Alarm for Lambda
aws cloudwatch put-metric-alarm \
    --alarm-name "mcp-prompts-lambda-high-duration" \
    --alarm-description "Lambda function duration above 5000ms" \
    --metric-name "Duration" \
    --namespace "AWS/Lambda" \
    --statistic "Average" \
    --period 300 \
    --evaluation-periods 3 \
    --threshold 5000 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=FunctionName,Value=McpPromptsStack-McpServerFunction7B2829A9-oCvEpw3wiMzw \
    --region eu-north-1

# Custom Application Error Alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "mcp-prompts-app-errors" \
    --alarm-description "High application error rate (>10%)" \
    --metric-name "Operations" \
    --namespace "MCP/Prompts" \
    --statistic "Sum" \
    --period 300 \
    --evaluation-periods 3 \
    --threshold 10 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=Status,Value=Error \
    --region eu-north-1

echo "✅ Created 9 CloudWatch alarms for comprehensive monitoring"

# List all alarms
echo ""
echo "📋 Created Alarms:"
aws cloudwatch describe-alarms --alarm-name-prefix "mcp-prompts" --region eu-north-1 --query 'MetricAlarms[*].{Name:AlarmName, Description:AlarmDescription}' --output table

