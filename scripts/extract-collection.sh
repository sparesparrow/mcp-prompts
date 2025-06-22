#!/bin/bash
set -e

# This script moves the prompt collection and catalog to their new home
# in preparation for the multi-repository migration.

echo "Moving prompt collection and catalog..."

# Define paths
MONOREPO_ROOT=$(pwd)
COLLECTION_DIR="mcp-prompts-collection"
PROMPTS_SRC="prompts"
CATALOG_SRC="packages/mcp-prompts-catalog"

# Ensure target directories exist
mkdir -p "$COLLECTION_DIR/prompts"
mkdir -p "$COLLECTION_DIR/catalog"

# Move the directories
# We use git mv to preserve history as much as possible before filtering
git mv "$PROMPTS_SRC" "$COLLECTION_DIR/"
git mv "$CATALOG_SRC" "$COLLECTION_DIR/"

echo "Successfully moved prompt data to $COLLECTION_DIR"

echo "Please review the changes and commit them." 