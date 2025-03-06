#!/bin/bash

# This script searches for prompts in your projects directory using a regex pattern.
# Example patterns:
# - Lines starting with "Prompt:": "^Prompt:"
# - JSON "content" fields: "\"content\": \".*\""
# - Specific keywords: "my_keyword"

# Check if at least one argument (the regex pattern) is provided
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 \"regex_pattern\" [projects_directory]"
    echo "  - regex_pattern: The regular expression to search for (in quotes)"
    echo "  - projects_directory: Optional directory to search (defaults to current directory)"
    exit 1
fi

# Assign arguments
PATTERN="$1"                # The regex pattern to search for
DIRECTORY="${2:-.}"         # The directory to search; defaults to current directory if not specified

# Verify that the directory exists and is actually a directory
if [ ! -d "$DIRECTORY" ]; then
    echo "Error: '$DIRECTORY' is not a directory or does not exist."
    exit 1
fi

# Inform the user what the script is doing
echo "Searching for pattern '$PATTERN' in '$DIRECTORY'..."

# Perform the search using grep
grep -r -I -H --color=auto --exclude-dir=.git -E "$PATTERN" "$DIRECTORY"
