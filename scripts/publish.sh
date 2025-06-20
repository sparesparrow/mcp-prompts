#!/usr/bin/env bash

# Exit on error
set -e

# Check if version increment is provided
if [ -z "$1" ]; then
  echo "Error: Please provide a version increment (patch, minor, or major)"
  echo "Usage: ./scripts/publish.sh [patch|minor|major]"
  exit 1
fi

VERSION_INCREMENT=$1

DOCKER_IMAGE_NAME="sparesparrow/mcp-prompts"

# Make sure we're in the project root
cd "$(dirname "$0")/.."

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: You have uncommitted changes. Please commit or stash them before publishing."
  exit 1
fi

# Run tests to make sure everything is working
echo "Running tests..."
npm test

# If tests pass, update the version
# echo "Updating version..."
# npm version $VERSION_INCREMENT

# Get the new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: $NEW_VERSION"

# Build the package
echo "Building the package..."
npm run build

# Check if build was successful
if [ ! -d "./dist" ]; then
  echo "Error: Build failed. The 'dist' directory was not created."
  exit 1
fi

# Publish to npm
echo "Publishing to npm..."
npm publish --tag latest --access public

# Build and push Docker image
echo "Building Docker image..."
docker build -t "$DOCKER_IMAGE_NAME:latest" -t "$DOCKER_IMAGE_NAME:$NEW_VERSION" -f docker/Dockerfile.prod .

# Push Docker image
echo "Pushing Docker image..."
docker push sparesparrow/mcp-prompts:$NEW_VERSION
docker push sparesparrow/mcp-prompts:latest

# Push changes to git
echo "Pushing changes to git..."
git push
git push --tags

echo "Successfully published version $NEW_VERSION"
echo "  npm: @sparesparrow/mcp-prompts@$NEW_VERSION"
echo "  Docker: sparesparrow/mcp-prompts:$NEW_VERSION"
echo "  Docker: sparesparrow/mcp-prompts:latest" 