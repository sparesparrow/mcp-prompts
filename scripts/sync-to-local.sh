#!/bin/bash
# Sync prompts from mcp-prompts repo to local ~/mcp/data/prompts/

set -euo pipefail

SOURCE_DIR="$(dirname "$0")/../data/prompts"
TARGET_DIR="$HOME/mcp/data/prompts"

echo "Syncing prompts from $SOURCE_DIR to $TARGET_DIR"

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

# Sync JSON files preserving directory structure
rsync -av --include='*/' --include='*.json' --exclude='*' "$SOURCE_DIR/" "$TARGET_DIR/"

# Count synced files
COUNT=$(find "$TARGET_DIR" -name '*.json' | wc -l)
echo "Synced $COUNT prompts to $TARGET_DIR"

# List synced categories
echo ""
echo "Categories synced:"
for dir in "$TARGET_DIR"/*/; do
    if [ -d "$dir" ]; then
        category=$(basename "$dir")
        count=$(find "$dir" -name '*.json' | wc -l)
        echo "  - $category: $count prompts"
    fi
done
