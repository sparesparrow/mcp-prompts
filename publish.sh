#!/usr/bin/env bash

# Exit on error
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

# Parse command line arguments for version increment type
VERSION_TYPE="patch"
TEST_AFTER_PUBLISH=true
DRY_RUN=false

for i in "$@"; do
  case $i in
    --major)
      VERSION_TYPE="major"
      shift
      ;;
    --minor)
      VERSION_TYPE="minor"
      shift
      ;;
    --patch)
      VERSION_TYPE="patch"
      shift
      ;;
    --no-test)
      TEST_AFTER_PUBLISH=false
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      echo "Running in dry-run mode (no actual changes will be made)"
      shift
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --major    Increment major version (x.0.0)"
      echo "  --minor    Increment minor version (0.x.0)"
      echo "  --patch    Increment patch version (0.0.x) [default]"
      echo "  --no-test  Skip testing after publishing"
      echo "  --dry-run  Show what would happen without making actual changes"
      echo "  --help     Show this help message"
      exit 0
      ;;
  esac
done

print_step "Preparing to publish MCP Prompts Server"

# Skip authentication checks in dry-run mode
if [ "$DRY_RUN" = false ]; then
  # Check if we're logged in to npm
  print_step "Checking npm authentication..."
  if ! npm whoami &> /dev/null; then
    print_error "Not logged in to npm. Please run 'npm login' first."
    exit 1
  fi
  print_success "Authenticated with npm"

  # Check if we're logged in to Docker Hub
  print_step "Checking Docker authentication..."
  if ! docker info &> /dev/null; then
    print_error "Docker daemon not running. Please start Docker."
    exit 1
  fi

  if ! docker info | grep -q "Username"; then
    print_warning "Not logged in to Docker Hub. Docker image won't be published."
    PUBLISH_DOCKER=false
  else
    print_success "Authenticated with Docker Hub"
    PUBLISH_DOCKER=true
  fi
else
  print_warning "Skipping authentication checks in dry-run mode"
  PUBLISH_DOCKER=true
fi

# Increment version
print_step "Incrementing version ($VERSION_TYPE)..."
if [ "$DRY_RUN" = true ]; then
  # Capture the last line of output which contains just the version number
  NEW_VERSION=$(node increment-version.js $VERSION_TYPE --dry-run | tail -n 1)
  if [ $? -ne 0 ]; then
    print_error "Failed to calculate new version"
    exit 1
  fi
  print_success "Would increment version to $NEW_VERSION"
  VERSION=$NEW_VERSION
else
  # Capture the last line of output which contains just the version number
  VERSION=$(node increment-version.js $VERSION_TYPE | tail -n 1)
  if [ $? -ne 0 ]; then
    print_error "Failed to increment version"
    exit 1
  fi
  print_success "Version incremented to $VERSION"
fi

# Get the package name from package.json
PACKAGE_NAME=$(node -p "require('./package.json').name")
DOCKER_IMAGE="sparesparrow/mcp-prompts"

# Clean build directory
if [ "$DRY_RUN" = false ]; then
  print_step "Cleaning build directory..."
  rm -rf build
  mkdir -p build
  print_success "Build directory cleaned"

  # Run the test build script
  print_step "Running test build..."
  ./scripts/test/test-build.sh
  print_success "Test build successful"
else
  print_warning "Skipping build in dry-run mode"
fi

print_step "Preparing to publish version $VERSION"

# Confirm with user
echo ""
echo "About to publish:"
echo "  - npm package: $PACKAGE_NAME@$VERSION"
if [ "$PUBLISH_DOCKER" = true ]; then
  echo "  - Docker image: $DOCKER_IMAGE:$VERSION and $DOCKER_IMAGE:latest"
fi
if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "DRY RUN: No actual changes will be made"
fi
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  print_warning "Publishing aborted"
  exit 0
fi

# Commit version change
if [ "$DRY_RUN" = false ]; then
  print_step "Committing version change to git..."
  git add package.json CHANGELOG.md
  git commit -m "chore: bump version to $VERSION"
  print_success "Version change committed"
else
  print_warning "Skipping git commit in dry-run mode"
fi

# Publish to npm
if [ "$DRY_RUN" = false ]; then
  print_step "Publishing package to npm..."
  # Add DOCKER_BUILD=true to avoid recursive npm build during publish
  cd build
  DOCKER_BUILD=true npm publish --access public
  cd ..
  print_success "Package published to npm: $PACKAGE_NAME@$VERSION"
else
  print_warning "Skipping npm publish in dry-run mode"
fi

# Build and publish Docker image if logged in
if [ "$PUBLISH_DOCKER" = true ] && [ "$DRY_RUN" = false ]; then
  print_step "Building Docker image..."
  docker build -t $DOCKER_IMAGE:$VERSION -t $DOCKER_IMAGE:latest .
  
  print_step "Publishing Docker image..."
  docker push $DOCKER_IMAGE:$VERSION
  docker push $DOCKER_IMAGE:latest
  print_success "Docker image published: $DOCKER_IMAGE:$VERSION and $DOCKER_IMAGE:latest"
elif [ "$PUBLISH_DOCKER" = true ] && [ "$DRY_RUN" = true ]; then
  print_warning "Skipping Docker image build and publish in dry-run mode"
fi

# Create a git tag for the release
if [ "$DRY_RUN" = false ]; then
  print_step "Creating git tag for version $VERSION..."
  git tag -a "v$VERSION" -m "Release version $VERSION"
  print_success "Git tag created: v$VERSION"
else
  print_warning "Skipping git tag creation in dry-run mode"
fi

if [ "$DRY_RUN" = false ]; then
  print_success "Publishing completed successfully!"
else
  print_success "Dry run completed successfully!"
fi

echo ""
echo "You can install the package with:"
echo "  npm install $PACKAGE_NAME@$VERSION"
echo ""
if [ "$PUBLISH_DOCKER" = true ]; then
  echo "You can run the Docker image with:"
  echo "  docker run -p 3003:3003 $DOCKER_IMAGE:$VERSION"
  echo ""
fi

echo "You can also use it directly with npx:"
echo "  npx -y $PACKAGE_NAME"
echo ""

# Test the published package if requested
if [ "$TEST_AFTER_PUBLISH" = true ] && [ "$DRY_RUN" = false ]; then
  print_step "Testing the published package with npx in Docker..."
  ./scripts/test/test-published-package.sh
  if [ $? -ne 0 ]; then
    print_error "Package testing failed!"
    exit 1
  fi
  print_success "Package testing completed successfully!"
elif [ "$TEST_AFTER_PUBLISH" = true ] && [ "$DRY_RUN" = true ]; then
  print_warning "Skipping package testing in dry-run mode"
fi