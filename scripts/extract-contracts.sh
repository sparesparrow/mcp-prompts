#!/bin/bash
set -e

# This script moves the API and data structure definitions (contracts)
# to their new home in preparation for the multi-repository migration.

echo "Moving contract files..."

# Define paths
CONTRACTS_DIR="mcp-prompts-contracts"
SRC_DIR="src"
TARGET_SRC_DIR="$CONTRACTS_DIR/src"

# Files to move
FILES_TO_MOVE=(
  "$SRC_DIR/interfaces.ts"
  "$SRC_DIR/schemas.ts"
)

# Ensure target directory exists
mkdir -p "$TARGET_SRC_DIR"

# Move the files
for file in "${FILES_TO_MOVE[@]}"; do
  if [ -f "$file" ]; then
    echo "Moving $file to $TARGET_SRC_DIR/"
    git mv "$file" "$TARGET_SRC_DIR/"
  else
    echo "Warning: $file not found, skipping."
  fi
done

echo "Successfully moved contract files to $CONTRACTS_DIR"

echo "Please review the changes and commit them." 