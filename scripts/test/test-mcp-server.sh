#!/usr/bin/env bash

# MCP Prompts Server Test Script
# This script tests the MCP Prompts server to ensure it's functioning correctly

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

# Create a temporary directory for testing
TEST_DIR=$(mktemp -d)
trap 'rm -rf $TEST_DIR' EXIT

print_step "Starting MCP Prompts Server tests"

# Step 1: Build the project
print_step "Building the project..."
npm run build
print_success "Build completed successfully"

# Step 2: Set up test environment
print_step "Setting up test environment..."
mkdir -p "$TEST_DIR/prompts"
mkdir -p "$TEST_DIR/backups"
print_success "Test environment ready"

# Step 3: Start the server in the background
print_step "Starting the server in the background..."
STORAGE_TYPE=file PROMPTS_DIR="$TEST_DIR/prompts" BACKUPS_DIR="$TEST_DIR/backups" npm start &
SERVER_PID=$!

# Wait for the server to start
sleep 3

# Clean up on exit
trap 'kill $SERVER_PID 2>/dev/null || true; rm -rf $TEST_DIR' EXIT

# Step 4: Test MCP Inspector connection
print_step "Testing connection with MCP Inspector..."
if npx @modelcontextprotocol/inspector ping >/dev/null 2>&1; then
  print_success "MCP Inspector connected successfully"
else
  print_error "MCP Inspector failed to connect"
  exit 1
fi

# Step 5: Test basic prompt operations
print_step "Testing basic prompt operations..."

# Create a test prompt
TEST_PROMPT='{
  "name": "test-prompt",
  "content": "This is a test prompt",
  "description": "Test prompt created by automated test",
  "tags": ["test"]
}'

echo "$TEST_PROMPT" > "$TEST_DIR/test_prompt.json"

# Use the add_prompt function
npx @modelcontextprotocol/inspector invoke add_prompt --args "$TEST_PROMPT" > "$TEST_DIR/add_result.json"

# Check if the prompt was added
if grep -q "test-prompt" "$TEST_DIR/add_result.json"; then
  print_success "Successfully added test prompt"
else
  print_error "Failed to add test prompt"
  cat "$TEST_DIR/add_result.json"
  exit 1
fi

# Get the prompt ID from the result
PROMPT_ID=$(grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' "$TEST_DIR/add_result.json" | cut -d'"' -f4)

# Get the prompt
npx @modelcontextprotocol/inspector invoke get_prompt --args "{\"id\":\"$PROMPT_ID\"}" > "$TEST_DIR/get_result.json"

# Check if the prompt was retrieved
if grep -q "This is a test prompt" "$TEST_DIR/get_result.json"; then
  print_success "Successfully retrieved test prompt"
else
  print_error "Failed to retrieve test prompt"
  cat "$TEST_DIR/get_result.json"
  exit 1
fi

# Update the prompt
UPDATE_PROMPT="{
  \"id\": \"$PROMPT_ID\",
  \"content\": \"This is an updated test prompt\",
  \"description\": \"Test prompt updated by automated test\"
}"

npx @modelcontextprotocol/inspector invoke update_prompt --args "$UPDATE_PROMPT" > "$TEST_DIR/update_result.json"

# Check if the prompt was updated
if grep -q "updated test prompt" "$TEST_DIR/update_result.json"; then
  print_success "Successfully updated test prompt"
else
  print_error "Failed to update test prompt"
  cat "$TEST_DIR/update_result.json"
  exit 1
fi

# List all prompts
npx @modelcontextprotocol/inspector invoke list_prompts --args "{}" > "$TEST_DIR/list_result.json"

# Check if the list includes our prompt
if grep -q "$PROMPT_ID" "$TEST_DIR/list_result.json"; then
  print_success "Successfully listed prompts"
else
  print_error "Failed to list prompts"
  cat "$TEST_DIR/list_result.json"
  exit 1
fi

# Delete the prompt
npx @modelcontextprotocol/inspector invoke delete_prompt --args "{\"id\":\"$PROMPT_ID\"}" > "$TEST_DIR/delete_result.json"

# Check if the prompt was deleted
if ! grep -q "error" "$TEST_DIR/delete_result.json"; then
  print_success "Successfully deleted test prompt"
else
  print_error "Failed to delete test prompt"
  cat "$TEST_DIR/delete_result.json"
  exit 1
fi

print_success "All MCP Prompts Server tests passed!"
print_step "Stopping the server..."
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null || true
print_success "Server stopped"

print_step "Cleaning up test files..."
rm -rf "$TEST_DIR"
print_success "Cleanup complete"

echo ""
echo "MCP Prompts Server is functioning correctly!" 