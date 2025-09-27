#!/bin/bash
set -e

echo "📊 Creating Comprehensive CloudWatch Dashboard..."

# Dashboard JSON with comprehensive metrics
cat > dashboard-config.json << 'DASHBOARD_EOF'
{
    "widgets": [
        {
            "type": "text",
            "width": 24,
            "height": 2,
            "properties": {
                "markdown": "# MCP-Prompts System Dashboard\n\n**API Gateway & Lambda Performance | DynamoDB & S3 Metrics | Custom Application Insights**\n\n*Last updated: $(date -u '+%Y-%m-%d %H:%M UTC')*"
            }
        },
        {
            "type": "metric",
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    ["AWS/ApiGateway", "Count", "ApiName", "McpPromptsApi", {"label": "Total Requests"}],
                    ["AWS/ApiGateway", "Latency", "ApiName", "McpPromptsApi", {"label": "Average Latency", "stat": "Average"}],
                    ["AWS/ApiGateway", "4XXError", "ApiName", "McpPromptsApi", {"label": "4XX Errors"}],
                    ["AWS/ApiGateway", "5XXError", "ApiName", "McpPromptsApi", {"label": "5XX Errors"}]
                ],
                "period": 300,
                "stat": "Sum",
                "region": "eu-north-1",
                "title": "API Gateway Performance",
                "view": "timeSeries",
                "stacked": false
            }
        },
        {
            "type": "metric",
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    ["AWS/Lambda", "Duration", "FunctionName", "McpPromptsStack-McpServerFunction7B2829A9-oCvEpw3wiMzw", {"label": "Lambda Duration (ms)", "stat": "Average"}],
                    ["AWS/Lambda", "Errors", "FunctionName", "McpPromptsStack-McpServerFunction7B2829A9-oCvEpw3wiMzw", {"label": "Lambda Errors"}],
                    ["AWS/Lambda", "Throttles", "FunctionName", "McpPromptsStack-McpServerFunction7B2829A9-oCvEpw3wiMzw", {"label": "Lambda Throttles"}],
                    ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", "McpPromptsStack-McpServerFunction7B2829A9-oCvEpw3wiMzw", {"label": "Concurrent Executions"}]
                ],
                "period": 300,
                "stat": "Average",
                "region": "eu-north-1",
                "title": "Lambda Function Metrics",
                "view": "timeSeries"
            }
        },
        {
            "type": "metric",
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "mcp-prompts", {"label": "Read Capacity"}],
                    ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", "mcp-prompts", {"label": "Write Capacity"}],
                    ["AWS/DynamoDB", "ThrottledRequests", "TableName", "mcp-prompts", {"label": "Throttled Requests"}],
                    ["AWS/DynamoDB", "ItemCount", "TableName", "mcp-prompts", {"label": "Total Items"}]
                ],
                "period": 300,
                "stat": "Sum",
                "region": "eu-north-1",
                "title": "DynamoDB Table Metrics",
                "view": "timeSeries"
            }
        },
        {
            "type": "metric",
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "mcp-sessions", {"label": "Session Read Capacity"}],
                    ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", "mcp-sessions", {"label": "Session Write Capacity"}],
                    ["AWS/DynamoDB", "ThrottledRequests", "TableName", "mcp-sessions", {"label": "Session Throttles"}]
                ],
                "period": 300,
                "stat": "Sum",
                "region": "eu-north-1",
                "title": "DynamoDB Sessions Table",
                "view": "timeSeries"
            }
        },
        {
            "type": "metric",
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    ["MCP/Prompts", "Operations", "Status", "Success", {"label": "Successful Operations"}],
                    ["MCP/Prompts", "Operations", "Status", "Error", {"label": "Failed Operations"}],
                    ["MCP/Prompts", "Duration", {"label": "Operation Duration (ms)", "stat": "Average"}]
                ],
                "period": 300,
                "stat": "Sum",
                "region": "eu-north-1",
                "title": "Custom Application Metrics",
                "view": "timeSeries"
            }
        },
        {
            "type": "metric",
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    ["AWS/S3", "NumberOfObjects", "BucketName", "mcp-prompts-catalog-875486186075-eu-north-1", "StorageType", "AllStorageTypes", {"label": "Total Objects"}],
                    ["AWS/S3", "BucketSizeBytes", "BucketName", "mcp-prompts-catalog-875486186075-eu-north-1", "StorageType", "StandardStorage", {"label": "Storage Size (bytes)"}],
                    ["AWS/S3", "AllRequests", "BucketName", "mcp-prompts-catalog-875486186075-eu-north-1", {"label": "Total Requests"}]
                ],
                "period": 3600,
                "stat": "Average",
                "region": "eu-north-1",
                "title": "S3 Storage Metrics",
                "view": "timeSeries"
            }
        },
        {
            "type": "log",
            "width": 24,
            "height": 8,
            "properties": {
                "query": "SOURCE '/aws/lambda/McpPromptsStack-McpServerFunction7B2829A9-oCvEpw3wiMzw' | fields @timestamp, @message\n| filter @message like /ERROR/ or @message like /WARN/\n| sort @timestamp desc\n| limit 100",
                "region": "eu-north-1",
                "title": "Recent Lambda Errors & Warnings",
                "view": "table"
            }
        },
        {
            "type": "log",
            "width": 24,
            "height": 6,
            "properties": {
                "query": "SOURCE '/aws/apigateway/McpPromptsApi' | fields @timestamp, requestId, ip, method, resourcePath, status, responseTime\n| filter status >= 400\n| sort @timestamp desc\n| limit 50",
                "region": "eu-north-1",
                "title": "Recent API Gateway Errors (4xx/5xx)",
                "view": "table"
            }
        }
    ]
}
DASHBOARD_EOF

# Create the dashboard
aws cloudwatch put-dashboard \
    --dashboard-name "mcp-prompts-production-dashboard" \
    --dashboard-body file://dashboard-config.json \
    --region eu-north-1

echo "✅ Created comprehensive CloudWatch dashboard: mcp-prompts-production-dashboard"

# Clean up
rm -f dashboard-config.json

echo "📊 Dashboard URL: https://eu-north-1.console.aws.amazon.com/cloudwatch/home?region=eu-north-1#dashboards:name=mcp-prompts-production-dashboard"
