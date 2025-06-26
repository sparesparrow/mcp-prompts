#!/bin/bash

# Script to update Docker commands in documentation files
# This script replaces deprecated 'docker-compose' with the modern 'docker compose' command

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DOCKER_DIR="${ROOT_DIR}/docker"
DOCS_DIR="${ROOT_DIR}/docs"
README_FILE="${ROOT_DIR}/README.md"

echo "Updating Docker commands in documentation files..."

# Update README.md
if [ -f "$README_FILE" ]; then
    echo "Processing README.md..."
    sed -i 's/docker-compose/docker compose/g' "$README_FILE"
fi

# Update documentation files
if [ -d "$DOCS_DIR" ]; then
    find "$DOCS_DIR" -type f -name "*.md" | while read -r file; do
        echo "Processing $file..."
        sed -i 's/docker-compose/docker compose/g' "$file"
    done
fi

# Update Docker documentation
if [ -d "$DOCKER_DIR" ]; then
    find "$DOCKER_DIR" -type f -name "*.md" | while read -r file; do
        echo "Processing $file..."
        sed -i 's/docker-compose/docker compose/g' "$file"
    done
fi

echo "Done updating Docker commands in documentation." 