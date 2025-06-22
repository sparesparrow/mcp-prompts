#!/bin/bash

# MCP Inspector Integration Test Runner
# 
# This script runs the MCP Inspector integration tests for the MCP-Prompts server.
# It sets up the necessary environment variables and runs the tests.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

print_status "Starting MCP Inspector integration tests..."

# Set environment variables for testing
export TEST_MCP_INSPECTOR=true
export NODE_ENV=test

# Check if npx is available
if ! command -v npx &> /dev/null; then
    print_error "npx is not installed or not in PATH"
    exit 1
fi

# Check if @modelcontextprotocol/inspector is available
if ! npx @modelcontextprotocol/inspector --help &> /dev/null; then
    print_warning "@modelcontextprotocol/inspector not found, installing..."
    npm install -g @modelcontextprotocol/inspector
fi

# Run the tests
print_status "Running MCP Inspector integration tests..."
npm test -- --testPathPattern="mcp-inspector.integration.test" --verbose

if [ $? -eq 0 ]; then
    print_success "MCP Inspector integration tests passed!"
else
    print_error "MCP Inspector integration tests failed!"
    exit 1
fi

print_status "MCP Inspector integration tests completed successfully!" 