#!/bin/sh
# Dynamic MCP server loader
# Clones and sets up MCP servers from GitHub repositories

# Create servers directory if it doesn't exist
mkdir -p /servers

# Function to clone and set up a server
setup_server() {
  repo_url=$1
  repo_name=$(basename $repo_url .git)
  
  echo "Setting up MCP server: $repo_name from $repo_url"
  
  # Check if already cloned
  if [ -d "/servers/$repo_name" ]; then
    echo "Repository already exists, updating..."
    cd "/servers/$repo_name"
    git pull
  else
    echo "Cloning repository..."
    cd /servers
    git clone $repo_url
    cd $repo_name
  fi
  
  # Install dependencies
  if [ -f "package.json" ]; then
    echo "Installing dependencies for $repo_name..."
    npm install
  fi
  
  # Build if needed
  if [ -f "tsconfig.json" ] && grep -q "build" package.json; then
    echo "Building $repo_name..."
    npm run build
  fi
  
  echo "Setup complete for $repo_name"
}

# Parse comma-separated list of repositories
IFS=','
for repo in $MCP_SERVER_URLS; do
  setup_server $repo
done

echo "All MCP servers have been set up in /servers"
echo "Available servers:"
ls -la /servers

# Keep container running
while true; do
  sleep 3600
done 