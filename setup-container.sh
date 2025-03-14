#!/bin/bash

# MCP Prompts Server Setup Script (Container Version)
# 
# This script is adapted to run in a Docker container environment
# It sets up the MCP Prompts Server environment, including:
# 1. Installing dependencies
# 2. Setting up the PostgreSQL database
# 3. Migrating prompts to the database
# 4. Building the application

set -e

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE=".env"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@postgres-setup:5432/mcp_prompts}"
PROMPTS_DIR="${PROMPTS_DIR:-/data/prompts}"
LOG_DIR="${LOG_DIR:-/data/logs}"
BACKUPS_DIR="${BACKUPS_DIR:-/data/backups}"

echo -e "${GREEN}Starting MCP Prompts server setup (Container Version)${NC}"

# Ensure directories exist
echo -e "Ensuring required directories exist..."
mkdir -p "${PROMPTS_DIR}" "${LOG_DIR}" "${BACKUPS_DIR}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "Installing dependencies..."
  npm install
fi

# Setup environment variables
echo -e "Setting up environment variables..."
if [ ! -f "$ENV_FILE" ]; then
  echo -e "Creating .env file..."
  cat > "$ENV_FILE" << EOF
# Storage configuration
STORAGE_TYPE=file
PROMPTS_DIR=${PROMPTS_DIR}

# Database configuration
DATABASE_URL=${DB_URL}

# Server configuration
SERVER_NAME=mcp-prompts
SERVER_VERSION=1.0.0
LOG_LEVEL=info
EOF
  echo -e "${GREEN}Created .env file${NC}"
else
  echo -e "${YELLOW}Using existing .env file${NC}"
fi

# Build the application
echo -e "Building the application..."
npm run build

# Check if we need to setup the database
if [[ "${STORAGE_TYPE}" == "postgres" || "${ENABLE_DATABASE_TOOLS}" == "true" ]]; then
  echo -e "Setting up database..."
  
  # Get database connection details from DATABASE_URL
  if [[ $DB_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
  else
    echo -e "${RED}Invalid DATABASE_URL format${NC}"
    exit 1
  fi
  
  # Wait for PostgreSQL to be ready
  echo -e "Waiting for PostgreSQL to be ready..."
  for i in {1..30}; do
    if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
      echo -e "${GREEN}PostgreSQL is ready!${NC}"
      break
    fi
    
    if [ $i -eq 30 ]; then
      echo -e "${RED}Could not connect to PostgreSQL. Please check your configuration.${NC}"
      exit 1
    fi
    
    echo -e "Waiting for PostgreSQL (attempt $i/30)..."
    sleep 2
  done
  
  # Initialize database
  echo -e "Initializing database schema..."
  node build/utils/init-db.js
  
  echo -e "${GREEN}Database setup complete!${NC}"
fi

# Create example prompts if directory is empty
if [ -z "$(ls -A "${PROMPTS_DIR}" 2>/dev/null)" ]; then
  echo -e "Creating example prompts..."
  mkdir -p "${PROMPTS_DIR}/examples"
  
  cat > "${PROMPTS_DIR}/examples/development-system-prompt.json" << EOF
{
  "id": "development-system-prompt",
  "name": "Development System Prompt",
  "description": "A template for creating development system prompts",
  "content": "You are a skilled developer specializing in {{language}}. Your task is to help build a {{project_type}} called {{project_name}}. The goal is to {{project_goal}}. Technical context: {{technical_context}}.",
  "isTemplate": true,
  "tags": ["development", "system-prompt", "template"],
  "category": "development",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "version": 1
}
EOF
  
  echo -e "${GREEN}Created example prompts in ${PROMPTS_DIR}/examples${NC}"
fi

echo -e "${GREEN}MCP Prompts server setup complete!${NC}"
echo -e "${GREEN}To start the server, run:${NC} npm start"
echo -e "${GREEN}To use the server with Claude Desktop, add to your configuration:${NC}"
echo '{
  "mcpServers": {
    "mcp-prompts": {
      "command": "node",
      "args": ["/path/to/mcp-prompts/build/index.js"]
    }
  }
}' 