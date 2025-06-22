#!/bin/bash
set -e

# This script moves the language-specific implementations (TypeScript, Rust)
# to their new homes in preparation for the multi-repository migration.

echo "Moving implementation source code..."

# --- TypeScript Implementation ---
echo "Moving TypeScript implementation to mcp-prompts-ts..."

TS_DIR="mcp-prompts-ts"
mkdir -p "$TS_DIR"

# Directories to move
TS_DIRS_TO_MOVE=(
  "src"
  "tests"
  "scripts"
  "data"
  "docker"
)

for dir in "${TS_DIRS_TO_MOVE[@]}"; do
  if [ -d "$dir" ]; then
    echo "Moving $dir/ to $TS_DIR/"
    git mv "$dir" "$TS_DIR/"
  else
    echo "Warning: Directory $dir not found, skipping."
  fi
done

# Root files to move
TS_FILES_TO_MOVE=(
  "package.json"
  "package-lock.json"
  "tsconfig.json"
  "jest.config.js"
  "eslint.config.js"
  "build.mjs"
  "index.mjs"
  "docker-compose.yml"
  "LICENSE"
  ".env.example"
  "test-catalog.cjs"
  "test-catalog.js"
)

for file in "${TS_FILES_TO_MOVE[@]}"; do
  if [ -f "$file" ]; then
    echo "Moving $file to $TS_DIR/"
    git mv "$file" "$TS_DIR/"
  else
    echo "Warning: File $file not found, skipping."
  fi
done

echo "Successfully moved TypeScript implementation."

# --- Rust Implementation ---
echo "Moving Rust implementation to mcp-prompts-rs..."

RS_DIR="mcp-prompts-rs"
RS_SRC_DIR="android_app/android/mcp_native_service"
mkdir -p "$RS_DIR"

if [ -d "$RS_SRC_DIR" ]; then
  # Move contents of the directory
  echo "Moving contents of $RS_SRC_DIR to $RS_DIR/"
  for item in "$RS_SRC_DIR"/*; do
    git mv "$item" "$RS_DIR/"
  done
  # Note: This leaves an empty mcp_native_service directory, which can be cleaned up later.
else
  echo "Warning: Directory $RS_SRC_DIR not found, skipping."
fi

echo "Successfully moved Rust implementation."


echo "Extraction script for implementations is ready."
echo "Please review the changes and commit them when you are ready to execute." 