# Testing MCP Server with curl

This guide demonstrates how to test a Model Context Protocol (MCP) server using curl commands.

## Prerequisites

- MCP server running on HTTP transport
- curl installed
- jq (optional, for JSON formatting)

## Basic MCP Testing Workflow

### 1. Start the MCP Server

First, ensure your MCP server is running in HTTP mode:

```bash
# For the mcp-prompts server
MODE=http STORAGE_TYPE=file PROMPTS_DIR=/path/to/prompts PORT=3003 node dist/index.js

# Or using npx
npx -y @sparesparrow/mcp-prompts@latest -- --port 3003
```

### 2. Initialize MCP Session

Start by initializing a session with the MCP server:

```bash
curl -X POST http://localhost:3003/mcp \
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
  }'
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "serverInfo": {
      "name": "mcp-prompts",
      "version": "3.0.6"
    }
  }
}
```

**Important:** Extract the `Mcp-Session-Id` from the response headers for subsequent requests.

### 3. List Available Tools

```bash
SESSION_ID="your-session-id-here"

curl -X POST http://localhost:3003/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

### 4. List Available Resources

```bash
curl -X POST http://localhost:3003/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "resources/list",
    "params": {}
  }'
```

### 5. List Available Prompts

```bash
curl -X POST http://localhost:3003/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "prompts/list",
    "params": {}
  }'
```

### 6. Call a Specific Tool

```bash
curl -X POST http://localhost:3003/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "tool-name",
      "parameters": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  }'
```

### 7. Get Prompt Details

```bash
curl -X POST http://localhost:3003/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "prompts/get",
    "params": {
      "name": "prompt-name"
    }
  }'
```

### 8. Read Resource Content

```bash
curl -X POST http://localhost:3003/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 7,
    "method": "resources/read",
    "params": {
      "uri": "resource://uri"
    }
  }'
```

## Complete Automated Test Script

Here's a complete bash script that automates the testing process:

```bash
#!/bin/bash
set -e

# Configuration
PORT=${1:-3003}
HOST="localhost"
BASE_URL="http://$HOST:$PORT"
MCP_ENDPOINT="$BASE_URL/mcp"

echo "Testing MCP Server on $BASE_URL"
echo "=================================="

# Function to make MCP requests and extract session ID
make_mcp_request() {
    local method=$1
    local params=$2
    local id=${3:-1}
    
    local request_data=$(cat <<EOF
{
    "jsonrpc": "2.0",
    "id": $id,
    "method": "$method",
    "params": $params
}
EOF
)
    
    echo "Request: $method"
    echo "$request_data" | jq '.' 2>/dev/null || echo "$request_data"
    
    local response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$request_data")
    
    echo "Response:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
    
    # Extract session ID from headers
    local session_id=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$request_data" \
        -i | grep -i "Mcp-Session-Id" | cut -d ' ' -f 2 | tr -d '\r')
    
    if [ -n "$session_id" ]; then
        echo "$session_id" > /tmp/mcp_session_id
        echo "Session ID: $session_id"
    fi
}

# Function to make authenticated requests
make_authenticated_request() {
    local method=$1
    local params=$2
    local id=${3:-1}
    
    local session_id=""
    if [ -f /tmp/mcp_session_id ]; then
        session_id=$(cat /tmp/mcp_session_id)
    fi
    
    local request_data=$(cat <<EOF
{
    "jsonrpc": "2.0",
    "id": $id,
    "method": "$method",
    "params": $params
}
EOF
)
    
    echo "Authenticated Request: $method"
    echo "$request_data" | jq '.' 2>/dev/null || echo "$request_data"
    
    local response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -H "Mcp-Session-Id: $session_id" \
        -d "$request_data")
    
    echo "Response:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
}

# Test sequence
echo "1. Health Check"
health_response=$(curl -s "$BASE_URL/health" 2>/dev/null || echo "Connection failed")
echo "Health response: $health_response"
echo ""

echo "2. Initialize MCP Session"
make_mcp_request "initialize" '{
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
}' 1

echo "3. List Tools"
make_authenticated_request "tools/list" '{}' 2

echo "4. List Resources"
make_authenticated_request "resources/list" '{}' 3

echo "5. List Prompts"
make_authenticated_request "prompts/list" '{}' 4

# Cleanup
rm -f /tmp/mcp_session_id

echo "MCP Server testing completed!"
```

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure the MCP server is running and listening on the correct port
2. **Invalid JSON**: Check that your JSON payload is properly formatted
3. **Missing Session ID**: Always include the `Mcp-Session-Id` header after initialization
4. **Method Not Found**: Verify the MCP server supports the methods you're calling

### Debug Commands

```bash
# Check if server is running
ps aux | grep "node dist/index.js"

# Check port usage
netstat -tlnp | grep :3003

# Test basic connectivity
curl -v http://localhost:3003/health

# Check server logs
tail -f /path/to/server.log
```

## Alternative Testing Tools

### MCP Inspector

The official MCP inspector provides a web interface for testing:

```bash
npx -y @modelcontextprotocol/inspector http://localhost:3003 --port 4000
```

### Python Client

You can also use the official MCP Python client:

```python
from mcp import ClientSession, StdioServerParameters
import asyncio

async def test_mcp():
    async with ClientSession(StdioServerParameters(
        command="node", args=["dist/index.js"]
    )) as session:
        # Test your MCP server
        pass

asyncio.run(test_mcp())
```

## Example Responses

### Successful Initialization
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "serverInfo": {
      "name": "mcp-prompts",
      "version": "3.0.6"
    }
  }
}
```

### Error Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

This guide provides a comprehensive approach to testing MCP servers with curl, covering all the essential MCP operations and common troubleshooting scenarios.

