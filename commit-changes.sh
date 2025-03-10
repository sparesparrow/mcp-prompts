#!/bin/bash

# Initialize git repository if needed
if [ ! -d ".git" ]; then
  git init
  git config user.name "SpareSparrow"
  git config user.email "sparrow@example.com"
fi

# Add all files
git add .

# Commit changes
git commit -m "Add project orchestrator functionality to MCP prompt manager"

# Tag the commit
git tag -a v1.1.0 -m "Version 1.1.0 with project orchestrator"

echo "Changes committed. To push to GitHub, run:"
echo "git remote add origin https://github.com/sparesparrow/mcp-prompt-manager.git"
echo "git push -u origin main --tags"