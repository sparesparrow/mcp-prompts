#!/bin/bash

# Read environment variables from .env file
if [ -f .env ]; then
  echo "Loading environment variables from .env file"
  
  # Read all environment variables from .env file
  while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip empty lines and comments
    if [[ ! $key =~ ^[[:space:]]*# && -n $key ]]; then
      # Trim whitespace
      key=$(echo $key | xargs)
      value=$(echo $value | xargs)
      
      if [ -n "$key" ]; then
        echo "Setting $key=$value"
        export "$key"="$value"
      fi
    fi
  done < .env
fi

# Start the MCP Prompts server
echo "Starting MCP Prompts server with the following configuration:"
echo "STORAGE_TYPE=${STORAGE_TYPE}"
echo "HTTP_SERVER=${HTTP_SERVER}"
echo "PORT=${PORT}"
echo "ENABLE_SSE=${ENABLE_SSE}"
echo "SSE_PATH=${SSE_PATH}"

# Try to run with exact environment variables
STORAGE_TYPE=$STORAGE_TYPE \
HTTP_SERVER=$HTTP_SERVER \
PORT=$PORT \
ENABLE_SSE=$ENABLE_SSE \
SSE_PATH=$SSE_PATH \
npx -y @sparesparrow/mcp-prompts 