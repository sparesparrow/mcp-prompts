#!/bin/bash
# Publish mcp-prompts to GitHub Packages

set -euo pipefail

# Check for GitHub token
if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "Error: GITHUB_TOKEN environment variable not set"
    echo "Set it with: export GITHUB_TOKEN=your_token"
    exit 1
fi

# Get version from package.json or argument
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
    VERSION=$(node -p "require('./package.json').version")
fi

echo "Publishing @sparesparrow/mcp-prompts@${VERSION} to GitHub Packages..."

# Setup npm for GitHub Packages
cp .npmrc.github .npmrc
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc

# Build package
echo "Building package..."
pnpm run build

# Publish
echo "Publishing to GitHub Packages..."
npm publish --registry https://npm.pkg.github.com

echo "✓ Successfully published @sparesparrow/mcp-prompts@${VERSION}"
echo ""
echo "Install with:"
echo "  npm install @sparesparrow/mcp-prompts@${VERSION} --registry https://npm.pkg.github.com"
echo ""
echo "Or add to .npmrc:"
echo "  @sparesparrow:registry=https://npm.pkg.github.com"