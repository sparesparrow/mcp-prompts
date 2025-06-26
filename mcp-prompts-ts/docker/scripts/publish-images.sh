#!/bin/bash
# Script to build and publish Docker images for MCP Prompts

set -e

# Change to the project root directory
cd "$(dirname "$0")/../.."
ROOT_DIR=$(pwd)

# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")
REPO="sparesparrow/mcp-prompts"

echo "=== Building and Publishing MCP Prompts Docker Images ==="
echo "Version: $VERSION"

# Build and push the main image
echo "Building main image..."
docker build -t $REPO:latest -t $REPO:$VERSION -f docker/Dockerfile .
echo "Publishing main image..."
docker push $REPO:latest
docker push $REPO:$VERSION

# Build and push the development image
echo "Building development image..."
docker build -t $REPO:dev -f docker/Dockerfile.dev .
echo "Publishing development image..."
docker push $REPO:dev

# Build and push the test image
echo "Building test image..."
docker build -t $REPO:test -f docker/Dockerfile.test .
echo "Publishing test image..."
docker push $REPO:test

echo "All images built and published successfully!"
