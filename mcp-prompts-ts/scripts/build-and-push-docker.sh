#!/bin/bash

# Script to build and push the MCP-Prompts Docker image to Docker Hub
# This script will:
# 1. Build the Docker image
# 2. Tag the image
# 3. Push the image to Docker Hub

set -e

# Default image name and tag
IMAGE_NAME="sparesparrow/mcp-prompts"
TAG="latest"

# Print header
echo "======================================================="
echo "   MCP-Prompts Docker Image Build and Push"
echo "======================================================="
echo ""

# Function to display usage information
function show_usage {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -t, --tag TAG       Specify a tag for the image (default: latest)"
  echo "  -h, --help          Display this help message"
  echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--tag)
      TAG="$2"
      shift 2
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_usage
      exit 1
      ;;
  esac
done

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker and try again."
  exit 1
else
  echo "✅ Docker is installed"
  
  # Check if Docker is running
  if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
  else
    echo "✅ Docker is running"
  fi
fi

# Check if user is logged in to Docker Hub
if ! docker info | grep -q "Username"; then
  echo "❌ You are not logged in to Docker Hub. Please run 'docker login' and try again."
  exit 1
else
  echo "✅ Logged in to Docker Hub"
fi

# Build the Docker image
echo "Building Docker image $IMAGE_NAME:$TAG..."
docker build -t "$IMAGE_NAME:$TAG" -f docker/Dockerfile .

# Check if build was successful
if [ $? -ne 0 ]; then
  echo "❌ Docker build failed"
  exit 1
else
  echo "✅ Docker image built successfully"
fi

# Ask for confirmation before pushing
echo ""
echo "You are about to push the following image to Docker Hub:"
echo "  $IMAGE_NAME:$TAG"
echo ""
read -p "Do you want to continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Push cancelled."
  exit 0
fi

# Push the image to Docker Hub
echo "Pushing Docker image to Docker Hub..."
docker push "$IMAGE_NAME:$TAG"

# Check if push was successful
if [ $? -ne 0 ]; then
  echo "❌ Failed to push Docker image to Docker Hub"
  exit 1
else
  echo "✅ Docker image pushed successfully"
fi

echo ""
echo "======================================================="
echo "   Build and Push Complete!"
echo "======================================================="
echo ""
echo "Image $IMAGE_NAME:$TAG is now available on Docker Hub"
echo "" 