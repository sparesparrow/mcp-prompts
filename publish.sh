#!/bin/bash

# Exit on error
set -e

echo "Building MCP Prompt Manager..."
npm run build

# Make sure index.js is executable
chmod +x build/index.js

# Validate package.json
echo "Validating package configuration..."
npm pkg fix

echo "Publishing to NPM as a public package..."
npm publish --access=public

echo "Package published successfully!"
echo "To use with Claude Desktop, add to your config.json:"
echo '{
  "mcpServers": {
    "prompt-manager-ts": {
      "command": "npx",
      "args": [
        "-y",
        "@sparesparrow/mcp-prompt-manager"
      ]
    }
  }
}'