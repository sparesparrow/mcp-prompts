#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "🚀 Installing MCP-Prompts..."

# Check system requirements
check_requirement() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ Required: $1 is not installed${NC}"
        return 1
    fi
    echo -e "${GREEN}✓ Found: $1${NC}"
    return 0
}

# Check all requirements
check_requirement node || exit 1
check_requirement npm || exit 1

# Install the package globally
echo "📦 Installing MCP-Prompts..."
npm install -g @sparesparrow/mcp-prompts

# Create default configuration
echo "⚙️ Creating default configuration..."
mkdir -p ~/.mcp-prompts
cat > ~/.mcp-prompts/config.json << EOL
{
  "storage": "file",
  "port": 3003,
  "prompts_dir": "~/.mcp-prompts/prompts"
}
EOL

echo -e "${GREEN}✅ Installation complete!${NC}"
echo "Run 'mcp-prompts' to start the server"
