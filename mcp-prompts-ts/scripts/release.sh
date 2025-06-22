#!/bin/bash
set -e

# Display help
function show_help {
  echo "Usage: ./release.sh [OPTIONS]"
  echo "Release a new version of MCP-Prompts"
  echo ""
  echo "Options:"
  echo "  -v, --version   Version type: patch, minor, major"
  echo "  -p, --publish   Publish to npm after version bump"
  echo "  -d, --docker    Build and push Docker image"
  echo "  -h, --help      Display this help message"
  echo ""
  echo "Example: ./release.sh --version minor --publish --docker"
  exit 0
}

# Parse arguments
VERSION_TYPE="patch"
PUBLISH=false
DOCKER=false

while [ "$1" != "" ]; do
  case $1 in
    -v | --version )
      shift
      VERSION_TYPE=$1
      ;;
    -p | --publish )
      PUBLISH=true
      ;;
    -d | --docker )
      DOCKER=true
      ;;
    -h | --help )
      show_help
      ;;
    * )
      echo "Unknown option: $1"
      show_help
      ;;
  esac
  shift
done

# Validate version type
if [[ "$VERSION_TYPE" != "patch" && "$VERSION_TYPE" != "minor" && "$VERSION_TYPE" != "major" ]]; then
  echo "Invalid version type: $VERSION_TYPE. Must be one of: patch, minor, major"
  exit 1
fi

# Skip git checks if SKIP_GIT_CHECKS environment variable is set
if [ "$SKIP_GIT_CHECKS" != "true" ]; then
  # Ensure we're on main branch
  CURRENT_BRANCH=$(git branch --show-current)
  if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Warning: You are not on the main branch."
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi

  # Make sure there are no uncommitted changes
  if [ -n "$(git status --porcelain)" ]; then
    echo "Error: There are uncommitted changes in the repository."
    echo "Please commit or stash your changes before running this script."
    exit 1
  fi
else
  echo "Skipping git checks due to SKIP_GIT_CHECKS=true"
fi

# Run tests
if [ "$SKIP_GIT_CHECKS" != "true" ]; then
  echo "Running tests..."
  npm test
fi

# If tests pass, bump version
echo "Bumping $VERSION_TYPE version..."
if [ "$SKIP_GIT_CHECKS" != "true" ]; then
  npm version $VERSION_TYPE
else
  echo "[TEST MODE] Would run: npm version $VERSION_TYPE"
fi

# Get the new version number
if [ "$SKIP_GIT_CHECKS" != "true" ]; then
  NEW_VERSION=$(node -p "require('./package.json').version")
else
  NEW_VERSION="0.0.0-test"
fi
echo "New version: $NEW_VERSION"

# Build the package
if [ "$SKIP_GIT_CHECKS" != "true" ]; then
  echo "Building package..."
  npm run build
else
  echo "[TEST MODE] Would run: npm run build"
fi

# Publish to npm if requested
if [ "$PUBLISH" = true ]; then
  if [ "$SKIP_GIT_CHECKS" != "true" ]; then
    echo "Publishing to npm..."
    npm publish
  else
    echo "[TEST MODE] Would run: npm publish"
  fi
fi

# Push changes to GitHub
if [ "$SKIP_GIT_CHECKS" != "true" ]; then
  echo "Pushing changes to GitHub..."
  git push
  git push --tags
else
  echo "[TEST MODE] Would run: git push && git push --tags"
fi

# Build and push Docker image if requested
if [ "$DOCKER" = true ]; then
  if [ "$SKIP_GIT_CHECKS" != "true" ]; then
    echo "Building and pushing Docker image..."
    docker build -t sparesparrow/mcp-prompts:$NEW_VERSION .
    docker tag sparesparrow/mcp-prompts:$NEW_VERSION sparesparrow/mcp-prompts:latest
    docker push sparesparrow/mcp-prompts:$NEW_VERSION
    docker push sparesparrow/mcp-prompts:latest
  else
    echo "[TEST MODE] Would build and push Docker images for version $NEW_VERSION"
  fi
fi

echo "Release $NEW_VERSION completed successfully!" 