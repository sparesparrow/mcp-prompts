#!/bin/bash

# Build all Docker images for MCP Prompts with different storage types
# Usage: ./scripts/build-all-docker.sh [--push] [--tag-version]

set -e

PUSH=false
TAG_VERSION=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --push)
      PUSH=true
      shift
      ;;
    --tag-version)
      TAG_VERSION="$2"
      shift 2
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo "🐳 Building Docker images for MCP Prompts with all storage types..."

# Build all storage-specific images
echo "📦 Building file storage image..."
pnpm run docker:build:file

echo "📦 Building memory storage image..."
pnpm run docker:build:memory

echo "📦 Building PostgreSQL storage image..."
pnpm run docker:build:postgres

echo "📦 Building AWS storage image..."
pnpm run docker:build:aws

echo "📦 Building MCP server image..."
pnpm run docker:build:mcp

# Tag with version if provided
if [ -n "$TAG_VERSION" ]; then
  echo "🏷️  Tagging images with version $TAG_VERSION..."
  docker tag sparesparrow/mcp-prompts:file sparesparrow/mcp-prompts:file-$TAG_VERSION
  docker tag sparesparrow/mcp-prompts:memory sparesparrow/mcp-prompts:memory-$TAG_VERSION
  docker tag sparesparrow/mcp-prompts:postgres sparesparrow/mcp-prompts:postgres-$TAG_VERSION
  docker tag sparesparrow/mcp-prompts:aws sparesparrow/mcp-prompts:aws-$TAG_VERSION
  docker tag sparesparrow/mcp-prompts:latest sparesparrow/mcp-prompts:$TAG_VERSION
fi

# Push to registries if requested
if [ "$PUSH" = true ]; then
  echo "🚀 Pushing images to Docker Hub..."
  pnpm run docker:push:dockerhub
  
  echo "🏷️  Tagging for GHCR..."
  pnpm run docker:tag:ghcr
  
  echo "🚀 Pushing to GitHub Container Registry..."
  pnpm run docker:push:ghcr
fi

echo "✅ All Docker images built successfully!"
echo ""
echo "Available images:"
docker images | grep sparesparrow/mcp-prompts | head -10
echo ""
echo "Usage examples:"
echo "  # Run with file storage"
echo "  docker run -p 3003:3003 -v \$(pwd)/data:/app/data sparesparrow/mcp-prompts:file"
echo ""
echo "  # Run with memory storage"
echo "  docker run -p 3003:3003 sparesparrow/mcp-prompts:memory"
echo ""
echo "  # Run with PostgreSQL (requires postgres container)"
echo "  docker-compose -f docker-compose.postgres.yml up"
echo ""
echo "  # Run with AWS storage (requires AWS credentials)"
echo "  docker run -p 3003:3003 -e AWS_ACCESS_KEY_ID=\$AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY=\$AWS_SECRET_ACCESS_KEY sparesparrow/mcp-prompts:aws"

