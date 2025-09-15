#!/bin/bash

# Simple MCP Server Testing with curl
# This script demonstrates how to test an MCP server using curl

echo "=== MCP Server Testing with curl ==="
echo ""

# Configuration
PORT=${1:-3003}
HOST="localhost"
MCP_ENDPOINT="http://$HOST:$PORT/mcp"

echo "Testing MCP server at: $MCP_ENDPOINT"
echo ""

# Test 1: Basic connectivity
echo "1. Testing basic connectivity..."
if curl -s "$HOST:$PORT/health" > /dev/null 2>&1; then
    echo "✓ Server is responding on /health endpoint"
else
    echo "✗ Server is not responding on /health endpoint"
    echo "   Make sure your MCP server is running with:"
    echo "   MODE=http STORAGE_TYPE=file PROMPTS_DIR=/path/to/prompts PORT=$PORT node dist/index.js"
    echo ""
    exit 1
fi
echo ""

# Test 2: Initialize MCP session
echo "2. Initializing MCP session..."
INIT_RESPONSE=$(curl -s -X POST "$MCP_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {
        "tools": {},
        "resources": {},
        "prompts": {}
      },
      "clientInfo": {
        "name": "curl-test-client",
        "version": "1.0.0"
      }
    }
  }')

echo "Response:"
echo "$INIT_RESPONSE" | jq '.' 2>/dev/null || echo "$INIT_RESPONSE"
echo ""

# Extract session ID from headers
SESSION_ID=$(curl -s -X POST "$MCP_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {
        "tools": {},
        "resources": {},
        "prompts": {}
      },
      "clientInfo": {
        "name": "curl-test-client",
        "version": "1.0.0"
      }
    }
  }' \
  -i | grep -i "Mcp-Session-Id" | cut -d ' ' -f 2 | tr -d '\r')

if [ -n "$SESSION_ID" ]; then
    echo "✓ Session ID: $SESSION_ID"
    echo "$SESSION_ID" > /tmp/mcp_session_id
else
    echo "✗ No session ID received"
    echo "   This might be normal for some MCP servers"
fi
echo ""

# Test 3: List tools
echo "3. Listing available tools..."
TOOLS_RESPONSE=$(curl -s -X POST "$MCP_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }')

echo "Response:"
echo "$TOOLS_RESPONSE" | jq '.' 2>/dev/null || echo "$TOOLS_RESPONSE"
echo ""

# Test 4: List resources
echo "4. Listing available resources..."
RESOURCES_RESPONSE=$(curl -s -X POST "$MCP_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "resources/list",
    "params": {}
  }')

echo "Response:"
echo "$RESOURCES_RESPONSE" | jq '.' 2>/dev/null || echo "$RESOURCES_RESPONSE"
echo ""

# Test 5: List prompts
echo "5. Listing available prompts..."
PROMPTS_RESPONSE=$(curl -s -X POST "$MCP_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "prompts/list",
    "params": {}
  }')

echo "Response:"
echo "$PROMPTS_RESPONSE" | jq '.' 2>/dev/null || echo "$PROMPTS_RESPONSE"
echo ""

# Cleanup
rm -f /tmp/mcp_session_id

echo "=== Testing completed ==="
echo ""
echo "If you received responses above, your MCP server is working correctly!"
echo ""
echo "To test specific tools or prompts, use:"
echo "curl -X POST $MCP_ENDPOINT \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Mcp-Session-Id: YOUR_SESSION_ID\" \\"
echo "  -d '{\"jsonrpc\": \"2.0\", \"id\": 1, \"method\": \"tools/call\", \"params\": {\"name\": \"tool-name\", \"parameters\": {}}}'"


