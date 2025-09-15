#!/bin/bash

# Stop any running MCP processes
pkill -f mcp-prompts || true

# Change to the custom-mcp directory
cd custom-mcp

# Install dependencies
npm install

# Export environment variables
export STORAGE_TYPE="memory"
export HTTP_SERVER="true"
export PORT="3000"
export ENABLE_SSE="true"
export SSE_PATH="/sse"
export HOST="0.0.0.0"

echo "Starting custom MCP Prompts server with memory storage"
echo "Environment variables:"
echo "STORAGE_TYPE=$STORAGE_TYPE"
echo "HTTP_SERVER=$HTTP_SERVER"
echo "PORT=$PORT"
echo "ENABLE_SSE=$ENABLE_SSE"
echo "SSE_PATH=$SSE_PATH"
echo "HOST=$HOST"

# Run the custom server
npm start 