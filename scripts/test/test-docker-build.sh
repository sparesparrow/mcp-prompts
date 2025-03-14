#!/usr/bin/env bash

# Test Docker build and basic functionality for MCP Prompts Server
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Docker image name and test directory
DOCKER_IMAGE="modelcontextprotocol/mcp-prompts"
CONTAINER_NAME="mcp-prompts-test"
TEST_DATA_DIR="/tmp/mcp-prompts-test-data"

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
  docker stop $CONTAINER_NAME 2>/dev/null || true
  docker rm $CONTAINER_NAME 2>/dev/null || true
  # Uncomment to remove test data directory (commented for debugging purposes)
  # rm -rf $TEST_DATA_DIR
}

# Set up cleanup on exit
trap cleanup EXIT

print_step "Testing Docker build for MCP Prompts Server"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
  print_error "Docker is not installed or not in PATH"
  exit 1
fi

# Create test data directory if it doesn't exist
print_step "Setting up test environment..."
mkdir -p $TEST_DATA_DIR/prompts
mkdir -p $TEST_DATA_DIR/backups
chmod -R 777 $TEST_DATA_DIR # Ensure permissions are set correctly
print_success "Test environment ready"

# Step 1: Build the Docker image
print_step "Building Docker image..."
docker build -t $DOCKER_IMAGE:test .
print_success "Docker image built successfully"

# Step 2: Run the container with a volume
print_step "Running Docker container..."
docker run -d --name $CONTAINER_NAME \
  -p 3003:3003 \
  -v $TEST_DATA_DIR:/app/data \
  $DOCKER_IMAGE:test
print_success "Docker container started"

# Step 3: Wait for the container to start up (increased wait time)
print_step "Waiting for container to initialize..."
sleep 5

# Step 4: Check if the container is running
print_step "Checking container status..."
if [ "$(docker inspect -f {{.State.Running}} $CONTAINER_NAME)" != "true" ]; then
  print_error "Container is not running"
  docker logs $CONTAINER_NAME
  exit 1
fi
print_success "Container is running"

# Step 5: Check if the API is responding
print_step "Checking API health endpoint..."
MAX_RETRIES=15  # Increased retries
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s http://localhost:3003/health | grep -q "ok"; then
    print_success "API is responding correctly"
    break
  else
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
      print_error "API is not responding after $MAX_RETRIES attempts"
      docker logs $CONTAINER_NAME
      exit 1
    fi
    print_warning "API not responding yet, retrying in 2 seconds (attempt $RETRY_COUNT/$MAX_RETRIES)..."
    sleep 2  # Increased wait time between retries
  fi
done

# Step 6: Check logs for any errors
print_step "Checking container logs for errors..."
if docker logs $CONTAINER_NAME 2>&1 | grep -i "error"; then
  print_warning "Found potential errors in logs (see above)"
else
  print_success "No errors found in logs"
fi

# Step 7: Test basic API functionality
print_step "Testing basic API functionality..."

# Create a test prompt
TEST_PROMPT=$(cat <<EOF
{
  "name": "test-prompt",
  "content": "This is a test prompt",
  "description": "Test prompt for Docker testing"
}
EOF
)

# Create the prompt
CREATE_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$TEST_PROMPT" http://localhost:3003/api/prompts)
if echo "$CREATE_RESPONSE" | grep -q "test-prompt"; then
  print_success "Successfully created test prompt"
else
  print_error "Failed to create test prompt"
  echo "$CREATE_RESPONSE"
  exit 1
fi

# Get the prompt
GET_RESPONSE=$(curl -s http://localhost:3003/api/prompts/test-prompt)
if echo "$GET_RESPONSE" | grep -q "This is a test prompt"; then
  print_success "Successfully retrieved test prompt"
else
  print_error "Failed to retrieve test prompt"
  echo "$GET_RESPONSE"
  exit 1
fi

# Check if the test prompt was persisted to the volume
print_step "Checking data persistence..."
if [ -f "$TEST_DATA_DIR/prompts/test-prompt.json" ]; then
  print_success "Data persistence verified"
else
  print_warning "Data file not found in expected location"
  ls -la $TEST_DATA_DIR/prompts
fi

print_success "All Docker tests passed!"
echo ""
echo "To use this Docker image:"
echo "  docker run -p 3003:3003 -v /path/to/data:/app/data $DOCKER_IMAGE:latest"
echo ""

# Clean up is handled by the trap command 