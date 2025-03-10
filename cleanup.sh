#!/bin/bash

# Exit on error
set -e

echo "================================================================"
echo "       MCP TypeScript Server Codebase Cleanup Script            "
echo "================================================================"

# Create backup
echo "Creating backup..."
BACKUP_DIR="/home/sparrow/mcp/backups/mcp-prompts-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r . "$BACKUP_DIR"
echo "Backup created at: $BACKUP_DIR"

# Remove unnecessary Dockerfiles
echo "Cleaning up Dockerfiles..."
rm -f Dockerfile.dev
rm -f Dockerfile.simplified
rm -f Dockerfile.production

# Keep only the working Dockerfile
mv Dockerfile.noprep Dockerfile

# Clean up docker-compose files
echo "Cleaning up docker-compose files..."
rm -f docker-compose.full.yml

# Clean up old scripts
echo "Cleaning up scripts..."
rm -f build-tools.js

# Organize configuration files
echo "Organizing configuration files..."
mkdir -p config/docker
mv docker/* config/docker/ 2>/dev/null || true
rmdir docker 2>/dev/null || true

# Update documentation
echo "Updating documentation..."
cat > CLEANED.md << 'EOF'
# MCP TypeScript Prompt Manager - Cleaned Repository

This repository has been cleaned up and organized for better maintainability.

## Directory Structure

- `src/`: Source code
- `build/`: Compiled JavaScript
- `config/`: Configuration files
  - `config/docker/`: Docker-related configuration
- `prompts/`: Sample prompt templates
- `node_modules/`: Dependencies (git-ignored)

## Docker Support

The repository now includes a single Dockerfile that works reliably for both development and production.

## Development Workflow

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript code:
   ```bash
   npm run build
   ```

3. Run the server locally:
   ```bash
   node build/index.js
   ```

4. Build and run in Docker:
   ```bash
   docker build -t mcp-prompts-ts:latest .
   docker run --rm -i -v mcp-prompts-ts-data:/data -v /path/to/prompts:/data/prompts mcp-prompts-ts:latest
   ```
EOF

echo "Codebase cleanup complete!"
echo "Please review the changes and the CLEANED.md file for documentation updates."
