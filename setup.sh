#!/bin/bash

# MCP Prompts Server Setup Script
#
# This script sets up the MCP Prompts Server environment, including:
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
DEFAULT_DB_URL="postgresql://postgres:postgres@localhost:5432/mcp_prompts"

# Check if the script is run as root (not recommended)
if [ "$(id -u)" == "0" ]; then
  echo -e "${YELLOW}Warning: Running as root is not recommended.${NC}"
  read -p "Continue anyway? (y/n): " answer
  if [ "$answer" != "y" ]; then
    exit 1
  fi
fi

# Function to prompt for value with default
prompt_with_default() {
  local prompt_message="$1"
  local default_value="$2"
  local var_name="$3"
  
  read -p "${prompt_message} [${default_value}]: " input
  if [ -z "$input" ]; then
    eval "$var_name=\"$default_value\""
  else
    eval "$var_name=\"$input\""
  fi
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to check if PostgreSQL is installed
check_postgres() {
  if command_exists psql; then
    echo -e "${GREEN}PostgreSQL client found.${NC}"
    return 0
  else
    echo -e "${YELLOW}PostgreSQL client not found.${NC}"
    return 1
  fi
}

# Function to test PostgreSQL connection
test_postgres_connection() {
  local db_url=$1
  echo "Testing PostgreSQL connection..."
  
  # Extract connection details from URL
  local host=$(echo $db_url | sed -n 's/.*@\([^:]*\).*/\1/p')
  local port=$(echo $db_url | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
  local db=$(echo $db_url | sed -n 's/.*\/\([^?]*\).*/\1/p')
  local user=$(echo $db_url | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
  
  # Try connecting
  if PGPASSWORD=$(echo $db_url | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql -h $host -p $port -U $user -d $db -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}Successfully connected to PostgreSQL.${NC}"
    return 0
  else
    echo -e "${RED}Failed to connect to PostgreSQL.${NC}"
    return 1
  fi
}

# Function to create a PostgreSQL database
create_postgres_db() {
  local db_url=$1
  local db=$(echo $db_url | sed -n 's/.*\/\([^?]*\).*/\1/p')
  local host=$(echo $db_url | sed -n 's/.*@\([^:]*\).*/\1/p')
  local port=$(echo $db_url | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
  local user=$(echo $db_url | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
  
  echo "Creating PostgreSQL database: $db"
  PGPASSWORD=$(echo $db_url | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql -h $host -p $port -U $user -c "CREATE DATABASE $db;" postgres || true
  echo -e "${GREEN}Database created or already exists.${NC}"
}

# Function to setup PostgreSQL
setup_postgres() {
  local db_url=$1
  
  echo "Setting up PostgreSQL..."
  
  # Check if PostgreSQL client is installed
  if ! check_postgres; then
    echo -e "${YELLOW}Please install PostgreSQL client before continuing.${NC}"
    echo "On Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "On macOS: brew install postgresql"
    echo "On Windows: Install PostgreSQL from https://www.postgresql.org/download/windows/"
    return 1
  fi
  
  # Test connection
  if ! test_postgres_connection $db_url; then
    echo -e "${YELLOW}Cannot connect to PostgreSQL. Please check your connection string.${NC}"
    return 1
  fi
  
  # Create database if needed
  create_postgres_db $db_url
  
  return 0
}

# Main setup process
echo "=== MCP Prompts Server Setup ==="
echo

# 1. Check and create .env file
if [ -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}Found existing $ENV_FILE file.${NC}"
  read -p "Do you want to recreate it? (y/n): " recreate_env
  if [ "$recreate_env" == "y" ]; then
    rm "$ENV_FILE"
  else
    echo "Keeping existing $ENV_FILE file."
    source "$ENV_FILE"
  fi
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Creating $ENV_FILE file..."
  
  # Get database connection string
  prompt_with_default "Enter PostgreSQL connection string" "$DEFAULT_DB_URL" "DB_URL"
  
  # Get port
  prompt_with_default "Enter server port" "3000" "PORT"
  
  # Get storage type
  prompt_with_default "Enter storage type (file, pgai, postgres)" "postgres" "STORAGE_TYPE"
  
  # Create .env file
  cat > "$ENV_FILE" << EOL
# PostgreSQL connection string
DATABASE_URL=$DB_URL

# Storage type (file, pgai, or postgres)
STORAGE_TYPE=$STORAGE_TYPE

# Server configuration
PORT=$PORT
HOST=localhost
LOG_LEVEL=info

# Storage location for prompts (used with file storage)
PROMPTS_DIR=./prompts

# Node environment
NODE_ENV=development
EOL
  
  echo -e "${GREEN}Created $ENV_FILE file.${NC}"
  source "$ENV_FILE"
fi

# 2. Install dependencies
echo "Installing dependencies..."
npm install
echo -e "${GREEN}Dependencies installed.${NC}"

# 3. Setup PostgreSQL if using it
if [ "$STORAGE_TYPE" == "postgres" ] || [ "$STORAGE_TYPE" == "pgai" ]; then
  if setup_postgres "$DATABASE_URL"; then
    echo -e "${GREEN}PostgreSQL setup complete.${NC}"
    
    # 4. Initialize database schema and migrate prompts
    echo "Initializing database..."
    npm run db:init || {
      echo -e "${RED}Database initialization failed. You may need to run the migrations manually:${NC}"
      echo "npm run db:migrate:schema"
      echo "npm run db:migrate:prompts"
    }
  else
    echo -e "${RED}PostgreSQL setup failed. You'll need to set it up manually.${NC}"
  fi
fi

# 5. Build the application
echo "Building the application..."
npm run build
echo -e "${GREEN}Build complete.${NC}"

echo
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo
echo "To start the server:"
echo "npm start"
echo
echo "To use Docker:"
echo "npm run docker:up"
echo
echo "For more commands, check the scripts in package.json"
echo

exit 0 