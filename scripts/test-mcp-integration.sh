#!/bin/bash
# Test MCP server integration
# This script validates that all configured MCP servers are working

set -e

echo "=== MCP Integration Test Script ==="
echo "Testing all configured MCP servers..."
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_server() {
    local server_name="$1"
    local expected_status="${2:-✓ Connected}"

    echo -n "Testing $server_name... "

    # Use claude mcp list and check for the server
    if claude mcp list 2>/dev/null | grep -q "$server_name"; then
        if claude mcp list 2>/dev/null | grep "$server_name" | grep -q "$expected_status"; then
            echo -e "${GREEN}✓ Connected${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ Listed but status unclear${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Not found${NC}"
        return 1
    fi
}

# Test mcp-prompts server
echo "=== Testing mcp-prompts ==="
test_server "mcp-prompts"

echo
echo "=== Testing sparetools servers ==="

# Check .cursor/mcp.json for sparetools servers
if [ -f "$HOME/.cursor/mcp.json" ]; then
    echo "Found .cursor/mcp.json configuration"

    # Extract server names from .cursor/mcp.json
    server_names=$(jq -r '.mcpServers | keys[]' "$HOME/.cursor/mcp.json" 2>/dev/null || echo "")

    if [ -n "$server_names" ]; then
        echo "Configured servers: $server_names"
        echo

        for server in $server_names; do
            test_server "$server"
        done
    else
        echo "No servers found in .cursor/mcp.json"
    fi
else
    echo ".cursor/mcp.json not found"
fi

echo
echo "=== Testing Claude Desktop Configuration ==="

# Check Claude Desktop config
if [ -f "$HOME/.config/Claude/claude_desktop_config.json" ]; then
    echo "Found Claude Desktop configuration"

    # Check if mcp-prompts is configured
    if jq -e '.mcpServers["mcp-prompts"]' "$HOME/.config/Claude/claude_desktop_config.json" >/dev/null 2>&1; then
        echo -e "mcp-prompts: ${GREEN}✓ Configured${NC}"
    else
        echo -e "mcp-prompts: ${RED}✗ Not configured${NC}"
    fi
else
    echo "Claude Desktop config not found"
fi

echo
echo "=== Testing HTTP Endpoints ==="

# Test mcp-prompts HTTP server
echo -n "Testing mcp-prompts HTTP server... "
if curl -s --max-time 5 http://localhost:3000/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"

    # Test MCP tools endpoint
    echo -n "Testing MCP tools endpoint... "
    if curl -s --max-time 5 http://localhost:3000/mcp/tools >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Available${NC}"
    else
        echo -e "${RED}✗ Unavailable${NC}"
    fi

    # Test prompts endpoint
    echo -n "Testing prompts endpoint... "
    if curl -s --max-time 5 http://localhost:3000/v1/prompts >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Available${NC}"
    else
        echo -e "${RED}✗ Unavailable${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Not running${NC}"
fi

echo
echo "=== Test Summary ==="
echo "Test completed: $(date)"
echo "Results saved to: mcp-test-report.json"

# Generate simple JSON report
cat > mcp-test-report.json << EOF
{
  "test_timestamp": "$(date -Iseconds)",
  "claude_cli_available": $(which claude >/dev/null 2>&1 && echo "true" || echo "false"),
  "cursor_config_exists": $([ -f "$HOME/.cursor/mcp.json" ] && echo "true" || echo "false"),
  "claude_desktop_config_exists": $([ -f "$HOME/.config/Claude/claude_desktop_config.json" ] && echo "true" || echo "false"),
  "http_server_running": $(curl -s --max-time 2 http://localhost:3000/health >/dev/null 2>&1 && echo "true" || echo "false")
}
EOF

echo "Report generated successfully!"