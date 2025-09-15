#!/bin/bash

# Script to set up the Docker directory structure for MCP Prompts
# This creates all necessary directories for the Docker setup

set -e

# Base directory
DOCKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "${DOCKER_DIR}/.." && pwd)"

echo "Setting up Docker directory structure in ${DOCKER_DIR}"

# Create directories
mkdir -p "${DOCKER_DIR}/postgres/init"
mkdir -p "${DOCKER_DIR}/scripts"
mkdir -p "${ROOT_DIR}/data/prompts"
mkdir -p "${ROOT_DIR}/data/backups"

# Create .dockerignore if it doesn't exist
if [ ! -f "${ROOT_DIR}/.dockerignore" ]; then
  echo "Creating .dockerignore file"
  cat > "${ROOT_DIR}/.dockerignore" << EOF
node_modules
npm-debug.log
.git
.github
.vscode
.idea
*.tgz
coverage
.env
.env.*
*.log
data
EOF
fi

# Check if all required Docker files exist
REQUIRED_FILES=(
  "${DOCKER_DIR}/Dockerfile.production"
  "${DOCKER_DIR}/Dockerfile.dev"
  "${DOCKER_DIR}/Dockerfile.test"
  "${DOCKER_DIR}/docker-compose.core.yml"
  "${DOCKER_DIR}/docker-compose.dev.yml"
  "${DOCKER_DIR}/docker-compose.test.yml"
  "${DOCKER_DIR}/docker-compose.integration.yml"
  "${DOCKER_DIR}/docker-compose.dynamic.yml"
  "${DOCKER_DIR}/docker-compose.pgai.yml"
  "${DOCKER_DIR}/postgres/init/01-init-extensions.sql"
  "${DOCKER_DIR}/scripts/install-github-server.sh"
)

MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Missing file: $file"
    MISSING_FILES=$((MISSING_FILES+1))
  fi
done

if [ $MISSING_FILES -gt 0 ]; then
  echo "Warning: $MISSING_FILES required Docker files are missing."
  echo "Please create them before using Docker."
else
  echo "All required Docker files are present."
fi

echo "Docker directory structure setup complete." 