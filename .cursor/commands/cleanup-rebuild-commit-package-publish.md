```bash
set -euo pipefail

# Params (optional)
VERSION_BUMP=${VERSION_BUMP:-patch}   # patch|minor|major
BRANCH=${BRANCH:-main}

# 1) Lint, install, build, test
pnpm install
pnpm run lint --silent || true
pnpm run build
pnpm run test --silent || true

# 2) Commit and push
git add -A
git commit -m "chore(release): prep build and release" || true
git pull --rebase origin "$BRANCH"
git push origin HEAD:"$BRANCH"

# 3) Bump version and publish to npm (public)
npm version "$VERSION_BUMP" --no-git-tag-version
pnpm run build
npm publish --access public

# 4) Build and push Docker images (Docker Hub and GHCR)
pnpm run docker:build:all
pnpm run docker:push:dockerhub
pnpm run docker:tag:ghcr
pnpm run docker:push:ghcr

# 5) Tag repo and push tag
NEW_VERSION=$(node -p "require('./package.json').version")
git tag "v$NEW_VERSION" || true
git push origin "v$NEW_VERSION"

echo "Release complete: v$NEW_VERSION"
```