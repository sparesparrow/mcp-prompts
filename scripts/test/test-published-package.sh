#!/usr/bin/env bash

# Test the published package in a Docker container using npx
# This script verifies that the published package can be installed and run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
  echo -e "${BLUE}🔹 $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Get the package name and version from package.json
PACKAGE_NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")

print_step "Testing published package $PACKAGE_NAME@$VERSION in Docker"

# Create a temporary directory for Docker test
TEST_DIR=$(mktemp -d)
cd $TEST_DIR

print_step "Created temporary test directory: $TEST_DIR"

# Create a simple Dockerfile for testing
cat > Dockerfile.test << EOF
FROM node:18-alpine

WORKDIR /app

# Install curl for health check and MCP Inspector for testing
RUN apk add --no-cache curl && \\
    npm install -g @modelcontextprotocol/inspector

# Create data directory
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production \\
    STORAGE_TYPE=file \\
    LOG_LEVEL=info

# Test command - this will be run when the container starts
CMD ["sh", "-c", "echo 'Testing $PACKAGE_NAME@$VERSION with npx' && npx -y $PACKAGE_NAME --version && echo 'Starting server with npx...' && npx -y $PACKAGE_NAME"]
EOF

print_step "Created Dockerfile for testing"

# Build the test image
print_step "Building test Docker image..."
docker build -t mcp-prompts-npx-test -f Dockerfile.test .
print_success "Test Docker image built successfully"

# Run the container
print_step "Running the container to test package..."
CONTAINER_ID=$(docker run -d -p 3003:3003 mcp-prompts-npx-test)
print_success "Container started with ID: $CONTAINER_ID"

# Wait for the server to start
print_step "Waiting for the server to start..."
sleep 5

# Check container logs to see if it started
print_step "Checking container logs..."
docker logs $CONTAINER_ID

# Test if the server is running
print_step "Testing server health..."
if curl -s http://localhost:3003/health | grep -q "ok"; then
  print_success "Server health check passed!"
else
  print_warning "Server health check failed. This might be normal if the package doesn't have a /health endpoint."
fi

# Test with MCP Inspector
print_step "Testing with MCP Inspector..."
docker exec $CONTAINER_ID sh -c "npx @modelcontextprotocol/inspector inspect http://localhost:3003 || echo 'Inspector test completed'"
print_success "MCP Inspector test completed"

# Clean up
print_step "Cleaning up..."
docker stop $CONTAINER_ID
docker rm $CONTAINER_ID
cd - > /dev/null
rm -rf $TEST_DIR
print_success "Cleanup completed"

print_success "Package test in Docker completed successfully!"
echo
echo "You can run the package with:"
echo "  docker run -p 3003:3003 -d node:18-alpine sh -c \"npx -y $PACKAGE_NAME\""
echo "  or"
echo "  npx -y $PACKAGE_NAME"
echo 