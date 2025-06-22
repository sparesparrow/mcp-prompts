#!/bin/bash

# Script to setup the MCP-Prompts server with SSE support for Claude desktop
# This script will:
# 1. Check if Claude desktop config file exists
# 2. Check if Docker is installed
# 3. Create a backup of the Claude desktop config file
# 4. Update the MCP Prompts server configuration in the Claude desktop config file
# 5. Start the MCP-Prompts server with SSE support

set -e

# Set default paths
CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
DEFAULT_PROMPTS_DIR="$HOME/mcp/data/prompts"
DEFAULT_BACKUPS_DIR="$HOME/mcp/data/backups"

# Print header
echo "======================================================="
echo "   MCP-Prompts Server Setup for Claude Desktop"
echo "======================================================="
echo ""

# Check if Claude desktop config file exists
if [ ! -f "$CLAUDE_CONFIG_FILE" ]; then
  echo "❌ Claude desktop config file not found at $CLAUDE_CONFIG_FILE"
  echo "Please make sure Claude desktop is installed and has been run at least once."
  exit 1
else
  echo "✅ Claude desktop config file found"
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker and try again."
  exit 1
else
  echo "✅ Docker is installed"
  
  # Check if Docker is running
  if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
  else
    echo "✅ Docker is running"
  fi
fi

# Create prompts and backups directories if they don't exist
echo "Setting up MCP data directories..."
mkdir -p "$DEFAULT_PROMPTS_DIR"
mkdir -p "$DEFAULT_BACKUPS_DIR"
echo "✅ MCP data directories created"

# Create a backup of the Claude desktop config file
BACKUP_FILE="${CLAUDE_CONFIG_FILE}.backup.$(date +%Y%m%d%H%M%S)"
cp "$CLAUDE_CONFIG_FILE" "$BACKUP_FILE"
echo "✅ Created backup of Claude desktop config at $BACKUP_FILE"

# Ask for user confirmation
echo ""
echo "This script will update your Claude desktop configuration"
echo "to use the MCP-Prompts server with SSE support."
echo ""
echo "The following directories will be used:"
echo "  Prompts directory: $DEFAULT_PROMPTS_DIR"
echo "  Backups directory: $DEFAULT_BACKUPS_DIR"
echo ""
read -p "Do you want to continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Setup cancelled."
  exit 0
fi

# Update the Claude desktop config file
echo "Updating Claude desktop config file..."

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "❌ jq is not installed. Please install jq and try again."
  echo "You can install jq with: sudo apt-get install jq"
  exit 1
fi

# Create a temporary file with the updated configuration
TMP_CONFIG_FILE="/tmp/claude_desktop_config_tmp.json"

# Update the MCP Prompts server configuration
jq --arg prompts_dir "$DEFAULT_PROMPTS_DIR" \
   --arg backups_dir "$DEFAULT_BACKUPS_DIR" \
   '.mcpServers.prompts = {
     "command": "docker",
     "args": [
       "run",
       "--rm",
       "-p",
       "3003:3003",
       "-v",
       "\($prompts_dir):/app/data/prompts",
       "-v",
       "\($backups_dir):/app/data/backups",
       "--name",
       "mcp-prompts-sse",
       "-e",
       "STORAGE_TYPE=file",
       "-e",
       "PROMPTS_DIR=/app/data/prompts",
       "-e",
       "BACKUPS_DIR=/app/data/backups",
       "-e",
       "HTTP_SERVER=true",
       "-e",
       "PORT=3003",
       "-e",
       "HOST=0.0.0.0",
       "-e",
       "ENABLE_SSE=true",
       "-e",
       "SSE_PATH=/events",
       "-e",
       "CORS_ORIGIN=*",
       "sparesparrow/mcp-prompts:latest"
     ]
   }' "$CLAUDE_CONFIG_FILE" > "$TMP_CONFIG_FILE"

# Check if the jq command was successful
if [ $? -ne 0 ]; then
  echo "❌ Failed to update Claude desktop config file"
  exit 1
fi

# Replace the original file with the updated one
mv "$TMP_CONFIG_FILE" "$CLAUDE_CONFIG_FILE"
echo "✅ Claude desktop config file updated successfully"

# Pull the Docker image
echo "Pulling the MCP-Prompts Docker image..."
docker pull sparesparrow/mcp-prompts:latest
echo "✅ Docker image pulled successfully"

# Ask if user wants to start the MCP-Prompts server now
echo ""
read -p "Do you want to start the MCP-Prompts server now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Starting MCP-Prompts server with SSE support..."
  docker run --rm -d -p 3003:3003 \
    -v "$DEFAULT_PROMPTS_DIR:/app/data/prompts" \
    -v "$DEFAULT_BACKUPS_DIR:/app/data/backups" \
    --name mcp-prompts-sse \
    -e STORAGE_TYPE=file \
    -e PROMPTS_DIR=/app/data/prompts \
    -e BACKUPS_DIR=/app/data/backups \
    -e HTTP_SERVER=true \
    -e PORT=3003 \
    -e HOST=0.0.0.0 \
    -e ENABLE_SSE=true \
    -e SSE_PATH=/events \
    -e CORS_ORIGIN=* \
    sparesparrow/mcp-prompts:latest
  
  if [ $? -eq 0 ]; then
    echo "✅ MCP-Prompts server started successfully"
    echo ""
    echo "To check the server status:"
    echo "  docker ps | grep mcp-prompts-sse"
    echo ""
    echo "To view server logs:"
    echo "  docker logs mcp-prompts-sse"
    echo ""
    echo "To stop the server:"
    echo "  docker stop mcp-prompts-sse"
  else
    echo "❌ Failed to start MCP-Prompts server"
  fi
else
  echo "Skipping server start."
  echo ""
  echo "You can start the server later with:"
  echo "  docker run --rm -d -p 3003:3003 \\"
  echo "    -v $DEFAULT_PROMPTS_DIR:/app/data/prompts \\"
  echo "    -v $DEFAULT_BACKUPS_DIR:/app/data/backups \\"
  echo "    --name mcp-prompts-sse \\"
  echo "    -e STORAGE_TYPE=file \\"
  echo "    -e PROMPTS_DIR=/app/data/prompts \\"
  echo "    -e BACKUPS_DIR=/app/data/backups \\"
  echo "    -e HTTP_SERVER=true \\"
  echo "    -e PORT=3003 \\"
  echo "    -e HOST=0.0.0.0 \\"
  echo "    -e ENABLE_SSE=true \\"
  echo "    -e SSE_PATH=/events \\"
  echo "    -e CORS_ORIGIN=* \\"
  echo "    sparesparrow/mcp-prompts:latest"
fi

echo ""
echo "======================================================="
echo "   Setup Complete!"
echo "======================================================="
echo ""
echo "Your Claude desktop is now configured to use the MCP-Prompts"
echo "server with SSE support. Restart Claude desktop to apply changes."
echo ""
echo "Your prompts are stored in: $DEFAULT_PROMPTS_DIR"
echo "Backups are stored in: $DEFAULT_BACKUPS_DIR"
echo "" 