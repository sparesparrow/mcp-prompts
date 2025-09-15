#!/bin/bash

# Kill any running MCP processes
pkill -f mcp-prompts || true

# Make sure we're using the correct environment variables
export STORAGE_TYPE="memory"
export HTTP_SERVER="true"
export PORT="3000" 
export ENABLE_SSE="true"
export SSE_PATH="/sse"
export HOST="0.0.0.0"

echo "Starting MCP Prompts server with explicit environment variables:"
echo "STORAGE_TYPE=$STORAGE_TYPE"
echo "HTTP_SERVER=$HTTP_SERVER"
echo "PORT=$PORT"
echo "ENABLE_SSE=$ENABLE_SSE"
echo "SSE_PATH=$SSE_PATH"
echo "HOST=$HOST"

# Run the command with exported variables
STORAGE_TYPE="memory" HTTP_SERVER="true" PORT="3000" ENABLE_SSE="true" SSE_PATH="/sse" HOST="0.0.0.0" npx -y @sparesparrow/mcp-prompts 