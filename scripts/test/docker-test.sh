#!/usr/bin/env bash

# Docker test workflow for MCP Prompts Server
# Runs tests in a containerized environment for consistent results

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

# Default test type
TEST_TYPE=${1:-"all"}

print_step "Starting Docker test workflow for MCP Prompts Server"

# Step 1: Build test docker image
print_step "Building test Docker image..."
docker build -t mcp-prompts-test -f docker/Dockerfile.test .
print_success "Test Docker image built successfully"

# Step 2: Create test network if it doesn't exist
print_step "Setting up Docker test network..."
docker network inspect mcp-test-network >/dev/null 2>&1 || docker network create mcp-test-network
print_success "Test network ready"

# Step 3: Start PostgreSQL container for testing if needed
if [[ "$TEST_TYPE" == "all" || "$TEST_TYPE" == "postgres" ]]; then
  print_step "Starting PostgreSQL container for testing..."
  # Stop existing container if it exists
  docker stop mcp-postgres-test >/dev/null 2>&1 || true
  docker rm mcp-postgres-test >/dev/null 2>&1 || true
  
  docker run -d --name mcp-postgres-test \
    --network mcp-test-network \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=mcp_prompts_test \
    -p 5434:5432 \
    postgres:14

  # Wait for PostgreSQL to be ready
  print_step "Waiting for PostgreSQL to be ready..."
  for i in {1..30}; do
    if docker exec mcp-postgres-test pg_isready -U postgres >/dev/null 2>&1; then
      print_success "PostgreSQL is ready"
      break
    fi
    
    if [ $i -eq 30 ]; then
      print_error "PostgreSQL failed to start"
      docker logs mcp-postgres-test
      exit 1
    fi
    
    echo -n "."
    sleep 1
  done
fi

# Step 4: Run tests based on test type
if [[ "$TEST_TYPE" == "all" || "$TEST_TYPE" == "unit" ]]; then
  print_step "Running unit tests..."
  docker run --rm \
    --name mcp-unit-tests \
    --network mcp-test-network \
    -v "$(pwd)"/tests:/app/tests \
    mcp-prompts-test npm test
  print_success "Unit tests completed successfully"
fi

if [[ "$TEST_TYPE" == "all" || "$TEST_TYPE" == "integration" ]]; then
  print_step "Running integration tests..."
  docker run --rm \
    --name mcp-integration-tests \
    --network mcp-test-network \
    -v "$(pwd)"/tests:/app/tests \
    -e STORAGE_TYPE=file \
    -e PROMPTS_DIR=/app/data/prompts \
    -e BACKUPS_DIR=/app/data/backups \
    mcp-prompts-test npm run test:integration
  print_success "Integration tests completed successfully"
fi

if [[ "$TEST_TYPE" == "all" || "$TEST_TYPE" == "postgres" ]]; then
  print_step "Running PostgreSQL storage tests..."
  docker run --rm \
    --name mcp-postgres-tests \
    --network mcp-test-network \
    -v "$(pwd)"/tests:/app/tests \
    -e STORAGE_TYPE=postgres \
    -e DATABASE_URL=postgresql://postgres:postgres@mcp-postgres-test:5432/mcp_prompts_test \
    mcp-prompts-test npm run test:integration
  print_success "PostgreSQL storage tests completed successfully"
fi

if [[ "$TEST_TYPE" == "all" || "$TEST_TYPE" == "mcp" ]]; then
  print_step "Running MCP protocol tests..."
  
  # Start the MCP server in a container
  docker run -d \
    --name mcp-server-test \
    --network mcp-test-network \
    -e STORAGE_TYPE=file \
    -e PROMPTS_DIR=/app/data/prompts \
    -e BACKUPS_DIR=/app/data/backups \
    mcp-prompts-test npm start
  
  # Wait for the server to be ready
  sleep 3
  
  # Run the MCP Inspector tests
  docker run --rm \
    --name mcp-inspector-test \
    --network mcp-test-network \
    node:20-alpine sh -c "npm install -g @modelcontextprotocol/inspector && \
      npx @modelcontextprotocol/inspector ping mcp-server-test:3003"
  
  # Stop the MCP server container
  docker stop mcp-server-test >/dev/null 2>&1 || true
  docker rm mcp-server-test >/dev/null 2>&1 || true
  
  print_success "MCP protocol tests completed successfully"
fi

# Step 5: Clean up test containers
print_step "Cleaning up test containers..."
docker stop mcp-postgres-test >/dev/null 2>&1 || true
docker rm mcp-postgres-test >/dev/null 2>&1 || true
print_success "Test cleanup complete"

print_success "All Docker tests completed successfully!"
echo ""
echo "Test results: All tests passed." 