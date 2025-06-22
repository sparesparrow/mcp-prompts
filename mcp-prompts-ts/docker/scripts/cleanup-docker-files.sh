#!/bin/bash
# Comprehensive cleanup script for Docker files in the MCP-Prompts project

# Set script to exit on error
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/docker"
LEGACY_DIR="$DOCKER_DIR/legacy"

# Create timestamp for backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Echo with color
function echo_info() {
  echo -e "\033[0;34m$1\033[0m"
}

function echo_success() {
  echo -e "\033[0;32m$1\033[0m"
}

function echo_warning() {
  echo -e "\033[0;33m$1\033[0m" 
}

echo_info "=== MCP-Prompts Docker Cleanup ==="
echo_info "Cleaning up old Docker files and organizing the Docker configuration..."

# Create legacy directory if it doesn't exist
mkdir -p "$LEGACY_DIR/$TIMESTAMP"
echo_info "Created legacy directory: $LEGACY_DIR/$TIMESTAMP"

# Move old backup directories to one consolidated legacy directory
echo_info "Moving legacy backup directories to consolidated location..."
find "$DOCKER_DIR" -type d -name "legacy_backup*" -exec mv {} "$LEGACY_DIR/$TIMESTAMP/" \; 2>/dev/null || true
find "$DOCKER_DIR" -type d -name "backup_*" -exec mv {} "$LEGACY_DIR/$TIMESTAMP/" \; 2>/dev/null || true
[ -d "$DOCKER_DIR/legacy_backup" ] && mv "$DOCKER_DIR/legacy_backup" "$LEGACY_DIR/$TIMESTAMP/" || true

# Move redundant Dockerfiles to legacy
echo_info "Moving redundant Dockerfiles to legacy directory..."
# Dockerfile.base/app are replaced by the standardized Dockerfile.prod/dev/test pattern
[ -f "$DOCKER_DIR/Dockerfile.base" ] && mv "$DOCKER_DIR/Dockerfile.base" "$LEGACY_DIR/$TIMESTAMP/" || true
[ -f "$DOCKER_DIR/Dockerfile.app" ] && mv "$DOCKER_DIR/Dockerfile.app" "$LEGACY_DIR/$TIMESTAMP/" || true

# Older Dockerfile naming conventions - use .prod/.development/.testing consistently
[ -f "$DOCKER_DIR/Dockerfile" ] && mv "$DOCKER_DIR/Dockerfile" "$LEGACY_DIR/$TIMESTAMP/" || true
[ -f "$DOCKER_DIR/Dockerfile.dev" ] && mv "$DOCKER_DIR/Dockerfile.dev" "$LEGACY_DIR/$TIMESTAMP/" || true
[ -f "$DOCKER_DIR/Dockerfile.test" ] && mv "$DOCKER_DIR/Dockerfile.test" "$LEGACY_DIR/$TIMESTAMP/" || true

# Move duplicate docker-compose files that should be in the compose directory
echo_info "Moving duplicate docker-compose files to legacy directory..."
[ -f "$DOCKER_DIR/docker-compose.dev.yml" ] && mv "$DOCKER_DIR/docker-compose.dev.yml" "$LEGACY_DIR/$TIMESTAMP/" || true
[ -f "$DOCKER_DIR/docker-compose.test.yml" ] && mv "$DOCKER_DIR/docker-compose.test.yml" "$LEGACY_DIR/$TIMESTAMP/" || true
[ -f "$DOCKER_DIR/docker-compose.integration.yml" ] && mv "$DOCKER_DIR/docker-compose.integration.yml" "$LEGACY_DIR/$TIMESTAMP/" || true
[ -f "$DOCKER_DIR/docker-compose.pgai.yml" ] && mv "$DOCKER_DIR/docker-compose.pgai.yml" "$LEGACY_DIR/$TIMESTAMP/" || true
[ -f "$DOCKER_DIR/docker-compose.postgres.yml" ] && mv "$DOCKER_DIR/docker-compose.postgres.yml" "$LEGACY_DIR/$TIMESTAMP/" || true
[ -f "$DOCKER_DIR/docker-compose.sse.yml" ] && mv "$DOCKER_DIR/docker-compose.sse.yml" "$LEGACY_DIR/$TIMESTAMP/" || true
[ -f "$DOCKER_DIR/docker-compose.yml" ] && mv "$DOCKER_DIR/docker-compose.yml" "$LEGACY_DIR/$TIMESTAMP/" || true

# Move docker-compose.yml from root to legacy if it exists
if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
  echo_info "Moving root docker-compose.yml to legacy..."
  cp "$PROJECT_ROOT/docker-compose.yml" "$LEGACY_DIR/$TIMESTAMP/"
fi

# Create README in the legacy directory
cat > "$LEGACY_DIR/README.md" << EOF
# Legacy Docker Files

This directory contains legacy Docker files that have been replaced by the standardized Docker setup.

## Directory Structure

Each timestamp directory contains files that were moved during a cleanup operation.

## Current Docker Setup

The current Docker setup uses the following structure:

- \`docker/Dockerfile.prod\`: Production Docker image
- \`docker/Dockerfile.development\`: Development Docker image with hot-reloading
- \`docker/Dockerfile.testing\`: Testing Docker image

Docker Compose files are organized in the \`docker/compose/\` directory:

- \`docker-compose.base.yml\`: Base configuration
- \`docker-compose.development.yml\`: Development environment
- \`docker-compose.test.yml\`: Testing environment
- \`docker-compose.postgres.yml\`: PostgreSQL integration
- \`docker-compose.pgai.yml\`: PGAI integration
- \`docker-compose.sse.yml\`: SSE support
- \`docker-compose.integration.yml\`: Multi-server integration

Use the \`docker/scripts/docker-compose-manager.sh\` script to manage Docker Compose.
EOF

# Update any scripts that reference the old paths
echo_info "Updating references to docker-compose files in scripts..."

# If the root docker-compose.yml exists, create a symbolic link to docker/compose/docker-compose.base.yml
if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
  echo_info "Creating symbolic link from root docker-compose.yml to docker/compose/docker-compose.base.yml..."
  mv "$PROJECT_ROOT/docker-compose.yml" "$PROJECT_ROOT/docker-compose.yml.bak"
  ln -sf "docker/compose/docker-compose.base.yml" "$PROJECT_ROOT/docker-compose.yml"
  echo_success "Created symbolic link: docker-compose.yml -> docker/compose/docker-compose.base.yml"
fi

# Clean up any unused docker volumes and networks
echo_info "Cleaning up unused Docker resources..."
echo_warning "This will remove unused Docker volumes and networks. Press Ctrl+C to cancel, or Enter to continue."
read -r

# Make sure Docker is running
if command -v docker &> /dev/null; then
  docker system prune -f
  docker volume prune -f
  docker network prune -f
else
  echo_warning "Docker command not found, skipping Docker resource cleanup."
fi

echo_success "Docker cleanup complete!"
echo_success "Old Docker files have been moved to $LEGACY_DIR/$TIMESTAMP/"
echo_success "See $LEGACY_DIR/README.md for more information." 