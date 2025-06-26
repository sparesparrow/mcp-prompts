#!/bin/sh

# Health check script for MCP Prompts Docker containers
# This script checks the health endpoint using either curl or wget

# Enable debug mode
set -x

# Get the port from the environment or default to 3003
PORT=${PORT:-3003}

# Print environment info for debugging
echo "Checking health for port: $PORT"
echo "Environment variables:"
env | grep -E 'PORT|HOST|STORAGE|NODE_ENV'

# Check if curl is available
if command -v curl >/dev/null 2>&1; then
  echo "Using curl for health check..."
  # Check if the server is responding 
  HEALTH_URL="http://localhost:${PORT}/health"
  HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" ${HEALTH_URL} || echo "failed")

  if [ "${HTTP_RESPONSE}" = "200" ]; then
      echo "Health check successful: ${HEALTH_URL} returned 200"
      exit 0
  else
      echo "Health check failed: ${HEALTH_URL} returned ${HTTP_RESPONSE}"
      exit 1
  fi
# If curl is not available, try wget
elif command -v wget >/dev/null 2>&1; then
  echo "Using wget for health check..."
  # Perform health check
  if wget -q --spider --timeout=10 http://localhost:$PORT/health; then
    echo "Health check passed!"
    exit 0
  else
    echo "Health check failed for http://localhost:$PORT/health"
    # Try one more time with full output for debugging
    wget --spider -S http://localhost:$PORT/health || true
    exit 1
  fi
else
  echo "Neither curl nor wget available for health check!"
  exit 1
fi 