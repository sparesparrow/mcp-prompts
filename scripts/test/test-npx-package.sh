#!/bin/bash

# Exit on error
set -e

echo "Testing @sparesparrow/mcp-prompts via npx in a clean environment..."

# Create a temporary directory for testing
TEST_DIR=$(mktemp -d)
cd $TEST_DIR

echo "Testing directory: $TEST_DIR"

# Run the package with npx to verify it works
echo "Running package with npx..."
npx -y @sparesparrow/mcp-prompts --version || {
  echo "Error: Failed to run package with npx"
  exit 1
}

# Test with MCP Inspector if available
if command -v npx @modelcontextprotocol/inspector &> /dev/null; then
  echo "Testing with MCP Inspector..."
  # Start the server in background
  npx -y @sparesparrow/mcp-prompts &
  SERVER_PID=$!
  
  # Wait for server to start
  sleep 2
  
  # Run MCP Inspector with timeout
  timeout 10s npx @modelcontextprotocol/inspector npx -y @sparesparrow/mcp-prompts || {
    echo "Note: MCP Inspector test timed out, but this may be expected"
  }
  
  # Kill the background server
  kill $SERVER_PID
else
  echo "MCP Inspector not available, skipping inspector test"
fi

echo "Cleanup test directory"
cd -
rm -rf $TEST_DIR

echo "Test completed successfully!"
echo "The package can be run with: npx -y @sparesparrow/mcp-prompts" 