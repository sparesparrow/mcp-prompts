#!/bin/bash
# Create release for mcp-prompts
# Usage: ./scripts/create-release.sh [version] [patch|minor|major]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Determine new version
if [ -n "${1:-}" ]; then
    NEW_VERSION="$1"
elif [ -n "${2:-}" ]; then
    # Bump version
    NEW_VERSION=$(npm version "$2" --no-git-tag-version | sed 's/v//')
else
    echo "Usage: $0 [version] [patch|minor|major]"
    echo "Example: $0 3.12.6"
    echo "Example: $0 '' patch"
    exit 1
fi

echo "New version: $NEW_VERSION"

# Update package.json
npm version "$NEW_VERSION" --no-git-tag-version

# Build
echo "Building package..."
pnpm install --frozen-lockfile
pnpm run build

# Commit changes
git add package.json package-lock.json
git commit -m "chore: Bump version to $NEW_VERSION"

# Create tag
TAG="v$NEW_VERSION"
git tag -a "$TAG" -m "Release $TAG

- Version: $NEW_VERSION
- Published to: npm, GitHub Packages, Cloudsmith, Docker"

echo ""
echo "✅ Release prepared:"
echo "   Version: $NEW_VERSION"
echo "   Tag: $TAG"
echo ""
echo "Next steps:"
echo "  1. Review changes: git log HEAD~1..HEAD"
echo "  2. Push tag: git push origin $TAG"
echo "  3. Push commits: git push origin main"
echo ""
echo "The GitHub Actions workflow will automatically:"
echo "  - Publish to npm"
echo "  - Publish to GitHub Packages"
echo "  - Publish to Cloudsmith"
echo "  - Build and push Docker image"
echo "  - Create GitHub release"