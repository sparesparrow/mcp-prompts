#!/bin/bash
set -e

# This script moves the prompt collection and catalog to their new home
# in preparation for the multi-repository migration.

echo "Moving prompt collection and catalog..."

# Define paths
MONOREPO_ROOT=$(pwd)
COLLECTION_DIR="mcp-prompts-catalog"
PROMPTS_SRC="prompts"
CATALOG_SRC="packages/mcp-prompts-catalog"

# Ensure target directories exist
mkdir -p "$COLLECTION_DIR/prompts"
mkdir -p "$COLLECTION_DIR/catalog"

# Move the contents of the prompts directory
echo "Moving prompts..."
if [ -d "$PROMPTS_SRC" ]; then
  # Move each item from the source to the destination
  for item in "$PROMPTS_SRC"/*; do
    if [ -e "$item" ]; then # Check if item exists to handle empty dirs
        git mv "$item" "$COLLECTION_DIR/prompts/"
    fi
  done
  # Attempt to remove the now-empty source directory
  rmdir "$PROMPTS_SRC" 2>/dev/null || true
else
  echo "Warning: Source directory $PROMPTS_SRC not found, skipping."
fi

# Move the contents of the catalog directory
echo "Moving catalog..."
if [ -d "$CATALOG_SRC" ]; then
  # Move each item from the source to the destination
  for item in "$CATALOG_SRC"/*; do
    if [ -e "$item" ]; then
        git mv "$item" "$COLLECTION_DIR/catalog/"
    fi
  done
  # Attempt to remove the now-empty source directory
  rmdir "$CATALOG_SRC" 2>/dev/null || true
else
  echo "Warning: Source directory $CATALOG_SRC not found, skipping."
fi

echo "Successfully moved prompt data to $COLLECTION_DIR"

echo "Please review the changes and commit them." 