#!/bin/sh

# Script to install MCP servers from GitHub URLs
# This script is meant to be run inside the mcp-builder container

set -e

# Default server directory
SERVERS_DIR="/servers"
mkdir -p "${SERVERS_DIR}"

# Parse command line options
if [ -z "$1" ]; then
  echo "Usage: $0 <github-repo-url> [branch]"
  echo "Example: $0 https://github.com/modelcontextprotocol/server-memory.git main"
  echo "No URL provided. Using default servers from environment variable MCP_SERVER_URLS"
fi

# Function to install an MCP server from a GitHub URL
install_server() {
  REPO_URL="$1"
  BRANCH="${2:-main}"  # Default to main branch if not specified
  
  # Extract repo name from URL
  REPO_NAME=$(basename "$REPO_URL" .git)
  
  echo "Installing MCP server from $REPO_URL (branch: $BRANCH)"
  
  # Create directory for this server
  SERVER_DIR="${SERVERS_DIR}/${REPO_NAME}"
  mkdir -p "${SERVER_DIR}"
  
  # Clone the repository
  if [ -n "$GITHUB_TOKEN" ]; then
    # Use token if available
    AUTH_URL="https://${GITHUB_TOKEN}@github.com/${REPO_URL#https://github.com/}"
    git clone --depth 1 --branch "$BRANCH" "$AUTH_URL" "${SERVER_DIR}"
  else
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "${SERVER_DIR}"
  fi
  
  # Navigate to server directory
  cd "${SERVER_DIR}"
  
  # Install dependencies and build
  if [ -f "package.json" ]; then
    echo "Installing Node.js dependencies..."
    npm install --production
    
    # Build if there's a build script
    if grep -q "\"build\"" package.json; then
      echo "Building server..."
      npm run build
    fi
  fi
  
  # Create a Dockerfile if one doesn't exist
  if [ ! -f "Dockerfile" ]; then
    echo "Creating Dockerfile..."
    cat > Dockerfile << EOF
FROM node:20-alpine

WORKDIR /app

COPY . .

# Install dependencies if not already installed
RUN test -d node_modules || npm install --production

# Expose default MCP port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
EOF
  fi
  
  echo "MCP server $REPO_NAME installed successfully at $SERVER_DIR"
}

# If specific repo URL provided, install just that one
if [ -n "$1" ]; then
  install_server "$1" "$2"
  exit 0
fi

# Otherwise, install servers from environment variable
if [ -n "$MCP_SERVER_URLS" ]; then
  echo "Installing MCP servers from MCP_SERVER_URLS environment variable"
  
  # Split the URLs by comma and install each one
  IFS=','
  for URL in $MCP_SERVER_URLS; do
    install_server "$URL"
  done
else
  echo "No MCP servers specified. Set MCP_SERVER_URLS environment variable or provide URL as argument."
  echo "Example: docker-compose run -e MCP_SERVER_URLS='https://github.com/repo1.git,https://github.com/repo2.git' mcp-builder"
fi 