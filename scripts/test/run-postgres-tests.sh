#!/usr/bin/env bash

# Run PostgreSQL adapter tests for MCP Prompts Server
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

cleanup() {
  print_step "Cleaning up..."
  
  # Check if Docker Compose is running and shut it down if it is
  if docker ps --format '{{.Names}}' | grep -q "mcp-prompts-server"; then
    print_step "Shutting down Docker Compose environment..."
    docker-compose -f docker/docker-compose.postgres.yml down
  fi
}

# Set up cleanup on exit
trap cleanup EXIT

# Get the root directory of the project
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

print_step "Starting PostgreSQL tests for MCP Prompts Server"

# Check if Docker and Docker Compose are available
if ! command -v docker &> /dev/null; then
  print_error "Docker is not installed or not in PATH"
  exit 1
fi

if ! command -v docker-compose &> /dev/null; then
  print_error "Docker Compose is not installed or not in PATH"
  exit 1
fi

# Install dependencies for the test script if needed
print_step "Installing test dependencies..."
npm install --no-save pg uuid node-fetch

# Start the Docker Compose environment
print_step "Starting Docker Compose environment..."
docker-compose -f docker/docker-compose.postgres.yml down --volumes --remove-orphans || true
docker-compose -f docker/docker-compose.postgres.yml up --build -d

# Wait for services to be ready
print_step "Waiting for services to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if docker ps --format '{{.Names}}' | grep -q "mcp-prompts-server" && \
     docker ps --format '{{.Status}}' | grep -q "Up .*mcp-prompts-server"; then
    print_success "MCP Prompts Server is running"
    break
  else
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
      print_error "MCP Prompts Server is not running after $MAX_RETRIES attempts"
      docker-compose -f docker/docker-compose.postgres.yml logs
      exit 1
    fi
    print_warning "MCP Prompts Server not running yet, retrying in 2 seconds (attempt $RETRY_COUNT/$MAX_RETRIES)..."
    sleep 2
  fi
done

# Wait a bit more to ensure the server is fully initialized
print_step "Waiting for the server to initialize..."
sleep 5

# Check the server logs
print_step "Checking server logs..."
docker-compose -f docker/docker-compose.postgres.yml logs mcp-prompts

# Run the test script
print_step "Running test script..."
MCP_SERVER_URL=http://localhost:3003 node scripts/test/test-postgres-adapter.js

# If we get here, tests completed successfully
print_success "PostgreSQL adapter tests completed successfully"
echo ""
echo "To use PostgreSQL with MCP Prompts Server:"
echo "  1. Set STORAGE_TYPE=postgres in your environment"
echo "  2. Set POSTGRES_CONNECTION_STRING to your PostgreSQL connection string"
echo "  3. Start the server"
echo ""
echo "Example:"
echo "  STORAGE_TYPE=postgres POSTGRES_CONNECTION_STRING=postgresql://user:password@host:port/database npm start"
echo "" 