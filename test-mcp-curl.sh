#!/bin/bash
set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PORT=${1:-3003}
HOST="localhost"
BASE_URL="http://$HOST:$PORT"
MCP_ENDPOINT="$BASE_URL/mcp"

echo -e "${BLUE}Testing MCP Server on $BASE_URL${NC}"
echo "=================================="

# Function to make MCP requests
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
    
    echo -e "${YELLOW}Request: $method${NC}"
    echo "$request_data" | jq '.' 2>/dev/null || echo "$request_data"
    
    local response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$request_data")
    
    echo -e "${GREEN}Response:${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
    
    # Extract session ID from headers if present
    local session_id=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$request_data" \
        -i | grep -i "Mcp-Session-Id" | cut -d ' ' -f 2 | tr -d '\r')
    
    if [ -n "$session_id" ]; then
        echo "$session_id" > /tmp/mcp_session_id
        echo -e "${GREEN}Session ID: $session_id${NC}"
    fi
    
    return 0
}

# Function to make authenticated MCP requests
make_authenticated_mcp_request() {
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
    
    echo -e "${YELLOW}Authenticated Request: $method${NC}"
    echo "$request_data" | jq '.' 2>/dev/null || echo "$request_data"
    
    local headers="-H 'Content-Type: application/json'"
    if [ -n "$session_id" ]; then
        headers="$headers -H 'Mcp-Session-Id: $session_id'"
    fi
    
    local response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -H "Mcp-Session-Id: $session_id" \
        -d "$request_data")
    
    echo -e "${GREEN}Response:${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
    
    return 0
}

# Test 1: Health check
echo -e "${BLUE}Test 1: Health Check${NC}"
health_response=$(curl -s "$BASE_URL/health" 2>/dev/null || echo "Connection failed")
echo "Health response: $health_response"
echo ""

# Test 2: Initialize MCP session
echo -e "${BLUE}Test 2: Initialize MCP Session${NC}"
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

# Test 3: List available tools
echo -e "${BLUE}Test 3: List Tools${NC}"
make_authenticated_mcp_request "tools/list" '{}' 2

# Test 4: List available resources
echo -e "${BLUE}Test 4: List Resources${NC}"
make_authenticated_mcp_request "resources/list" '{}' 3

# Test 5: List available prompts
echo -e "${BLUE}Test 5: List Prompts${NC}"
make_authenticated_mcp_request "prompts/list" '{}' 4

# Test 6: Get prompt details (if any exist)
echo -e "${BLUE}Test 6: Get Prompt Details${NC}"
make_authenticated_mcp_request "prompts/get" '{
    "name": "example-prompt"
}' 5

# Test 7: Call a specific tool (if available)
echo -e "${BLUE}Test 7: Call Tool${NC}"
make_authenticated_mcp_request "tools/call" '{
    "name": "example-tool",
    "parameters": {}
}' 6

# Test 8: Get resource content (if any exist)
echo -e "${BLUE}Test 8: Get Resource Content${NC}"
make_authenticated_mcp_request "resources/read" '{
    "uri": "example://resource"
}' 7

# Cleanup
rm -f /tmp/mcp_session_id

echo -e "${GREEN}MCP Server testing completed!${NC}"

