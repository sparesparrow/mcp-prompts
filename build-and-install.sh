#!/bin/bash
# Make the script executable
chmod +x "$0"

# Exit on error
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Make build.sh executable
chmod +x build.sh

# Run the build script
./build.sh

# Check if the build was successful
if [ ! -d "./build" ]; then
  echo "Error: Build failed, build directory not found"
  exit 1
fi

# Update the Claude configuration to use this server
CONFIG_FILE="$HOME/.config/Claude/claude_desktop_config.json"

if [ -f "$CONFIG_FILE" ]; then
  echo "Updating Claude configuration for prompt-manager..."
  
  # Create a backup of the existing configuration
  cp "$CONFIG_FILE" "${CONFIG_FILE}.backup"
  
  # Check if jq is installed
  if ! command -v jq &> /dev/null; then
    echo "Warning: jq is not installed. Skipping automated configuration update."
    echo "Please manually add prompt-manager configuration to $CONFIG_FILE"
  else
    # Add/update the prompt-manager configuration
    jq ".mcpServers.\"prompt-manager\" = {\"command\": \"node\", \"args\": [\"$SCRIPT_DIR/build/index.js\"]}" "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
    mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    echo "Configuration updated successfully."
  fi
else
  echo "Warning: Claude configuration file not found at $CONFIG_FILE"
  echo "Please manually create the configuration file."
fi

echo "Installation complete!"
echo "Please restart Claude Desktop to use the Prompt Manager MCP server."
