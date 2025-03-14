#!/usr/bin/env bash
# Manual Docker test script for MCP Prompts Server
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
  print_step "Cleaning up containers..."
  docker-compose -f docker/docker-compose.yml down 2>/dev/null || true
  docker-compose -f docker/docker-compose.postgres.yml down 2>/dev/null || true
  docker-compose -f docker/docker-compose.test.yml down 2>/dev/null || true
  docker-compose -f docker/docker-compose.dev.yml down 2>/dev/null || true
}

# Setup cleanup on exit
trap cleanup EXIT

print_step "📦 Manual Docker test for MCP Prompts Server"
print_step "====================================="
echo ""

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
  print_error "Docker is not running. Please start Docker and try again."
  exit 1
fi

print_step "Available test options:"
echo "1. Run with file storage (default)"
echo "2. Run with PostgreSQL storage"
echo "3. Run with Inspector attached"
echo "4. Run in development mode with hot reload"
echo "5. Build and test Docker image"
echo "q. Quit"
echo ""

read -p "Select an option (1-5, or q to quit): " option

case $option in
  1)
    print_step "Running with file storage..."
    docker run -p 3003:3003 \
      -v "$(pwd)/prompts:/app/data/prompts" \
      -e "LOG_LEVEL=debug" \
      sparesparrow/mcp-prompts:latest
    ;;
  2)
    print_step "Running with PostgreSQL storage..."
    docker-compose -f docker/docker-compose.postgres.yml up
    ;;
  3)
    print_step "Running with Inspector attached..."
    docker-compose -f docker/docker-compose.test.yml up
    ;;
  4)
    print_step "Running in development mode..."
    docker-compose -f docker/docker-compose.dev.yml up
    ;;
  5)
    print_step "Building and testing Docker image..."
    ./scripts/test/test-docker-build.sh
    ;;
  q|Q)
    print_step "Exiting..."
    exit 0
    ;;
  *)
    print_error "Invalid option"
    exit 1
    ;;
esac 