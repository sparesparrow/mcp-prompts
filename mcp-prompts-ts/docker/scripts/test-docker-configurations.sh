#!/bin/bash
# Docker Configurations Test Script for MCP Prompts
# Tests all Docker Compose configurations to ensure they work correctly

set -e

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Docker Compose configurations${NC}"

# Function to test a Docker Compose configuration
function test_configuration() {
    local name=$1
    local env=$2
    local profiles=$3
    
    echo -e "${YELLOW}Testing ${name} configuration${NC}"
    echo -e "${GREEN}Environment: ${env}${NC}"
    echo -e "${GREEN}Profiles: ${profiles}${NC}"
    
    # Build and start containers
    if [ -z "$profiles" ]; then
        docker/scripts/docker-compose-manager.sh up -e "$env"
    else
        # Split profiles by comma and add each as a separate -p argument
        IFS=',' read -ra PROFILE_ARRAY <<< "$profiles"
        PROFILE_ARGS=""
        for profile in "${PROFILE_ARRAY[@]}"; do
            PROFILE_ARGS="$PROFILE_ARGS -p $profile"
        done
        
        docker/scripts/docker-compose-manager.sh up -e "$env" $PROFILE_ARGS
    fi
  
  # Wait for containers to start
    echo "Waiting 10 seconds for containers to start..."
    sleep 10
    
    # Check container status
    docker/scripts/docker-compose-manager.sh ps -e "$env"
    
    # Clean up
    docker/scripts/docker-compose-manager.sh down -e "$env"
    
    echo -e "${GREEN}Test completed for ${name} configuration${NC}"
    echo ""
}

# Build Docker images first
echo -e "${BLUE}Building Docker images${NC}"
docker/scripts/docker-compose-manager.sh image -e production -t test
docker/scripts/docker-compose-manager.sh image -e development -t test
docker/scripts/docker-compose-manager.sh image -e test -t test

# Test configurations
echo -e "${BLUE}Testing basic configurations${NC}"
test_configuration "Base Production" "production" ""
test_configuration "Development" "development" ""
test_configuration "Test" "test" ""

echo -e "${BLUE}Testing database configurations${NC}"
test_configuration "Production with PostgreSQL" "production" "postgres"
test_configuration "Development with PostgreSQL" "development" "postgres"
test_configuration "Production with PostgreSQL and Adminer" "production" "postgres,adminer"

echo -e "${BLUE}Testing integration configurations${NC}"
test_configuration "Production with SSE" "production" "sse"
test_configuration "Production with PGAI" "production" "pgai"
test_configuration "Production with Integration" "production" "integration"

echo -e "${BLUE}Testing complex configurations${NC}"
test_configuration "Development with PostgreSQL and SSE" "development" "postgres,sse"
test_configuration "Production with Full Stack" "production" "postgres,adminer,sse,integration"

echo -e "${GREEN}All Docker Compose configurations tested successfully${NC}" 