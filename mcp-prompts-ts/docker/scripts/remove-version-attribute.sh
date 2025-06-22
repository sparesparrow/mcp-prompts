#!/bin/bash

# Script to remove the obsolete version attribute from Docker Compose files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DOCKER_DIR="${ROOT_DIR}/docker"
LEGACY_DIR="${DOCKER_DIR}/legacy"

echo "Removing obsolete version attribute from Docker Compose files..."

# Function to remove version attribute
remove_version() {
    local file="$1"
    echo "Processing file: $file"
    
    # Check if file has version attribute
    if grep -q "^version:" "$file"; then
        # Create a temporary file
        local tmp_file=$(mktemp)
        
        # Filter out the version line and write to temporary file
        grep -v "^version:" "$file" > "$tmp_file"
        
        # Replace original file with temporary file
        mv "$tmp_file" "$file"
        
        echo "  ✓ Removed version attribute from $file"
    else
        echo "  ✓ No version attribute found in $file"
    fi
}

# Process all Docker Compose files in the main directories
for dir in "${ROOT_DIR}" "${DOCKER_DIR}" "${LEGACY_DIR}"; do
    if [ -d "$dir" ]; then
        for file in "$dir"/*.yml; do
            if [ -f "$file" ]; then
                remove_version "$file"
            fi
        done
    fi
done

echo "Done removing obsolete version attributes." 