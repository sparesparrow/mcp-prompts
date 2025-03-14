#!/usr/bin/env bash

# Test build script for MCP Prompts Server
# Verifies the build process with the new import fixing strategy

set -e
echo "🧪 Testing MCP Prompts Server build..."

# Step 1: Clean the build directory
echo "🧹 Cleaning build directory..."
rm -rf build
mkdir -p build

# Step 2: Build the package
echo "🔨 Building package..."
npx tsc

# Step 3: Copy over static files and make executable
echo "📂 Copying files and making executable..."
cp package.json build/
cp README.md build/
mkdir -p build/data/prompts
mkdir -p build/data/backups

# Check if templates directory exists and copy if it does
if [ -d "templates" ]; then
  cp -r templates build/
  echo "✅ Copied templates directory"
else
  echo "⚠️ Templates directory not found, creating an empty one"
  mkdir -p build/templates
fi

# Copy src/config.js if it exists, otherwise copy from src/config.ts
if [ -f "src/config.js" ]; then
  cp src/config.js build/
  echo "✅ Copied src/config.js"
else
  echo "⚠️ src/config.js not found, will compile from TypeScript"
fi

# Create directories for data
mkdir -p build/data
mkdir -p build/data/prompts
mkdir -p build/data/backups

# Ensure the index.js file is executable
chmod +x build/index.js

# Step 4: Run the comprehensive build fixer
echo "🔧 Running build fixer..."
node ./scripts/build/fix-build.js

# Step 5: Fix the package.json in the build directory
echo "📦 Fixing package.json in build directory..."
node ./scripts/build/fix-package.js

echo "✅ Build process completed successfully"
echo "📦 You can now test the built package with: cd build && npm link" 