#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Display help
function show_help {
  echo -e "${BLUE}MCP Prompts Docker Management Script${NC}"
  echo -e "${YELLOW}Usage:${NC} ./docker-manage.sh [COMMAND] [ENVIRONMENT]"
  echo ""
  echo -e "${YELLOW}Commands:${NC}"
  echo "  start       - Start Docker containers"
  echo "  stop        - Stop Docker containers"
  echo "  restart     - Restart Docker containers"
  echo "  logs        - Show logs from containers"
  echo "  clean       - Remove containers, networks, and volumes"
  echo "  build       - Build Docker images"
  echo "  test        - Run tests in Docker containers"
  echo "  publish     - Build and publish Docker image"
  echo "  help        - Display this help message"
  echo ""
  echo -e "${YELLOW}Environments:${NC}"
  echo "  dev         - Development environment (default)"
  echo "  test        - Testing environment"
  echo "  prod        - Production environment"
  echo "  postgres    - PostgreSQL environment"
  echo "  health      - Health check environment"
  echo ""
  echo -e "${YELLOW}Examples:${NC}"
  echo "  ./docker-manage.sh start dev    - Start development environment"
  echo "  ./docker-manage.sh test         - Run tests in Docker"
  echo "  ./docker-manage.sh logs prod    - View logs from production environment"
  echo "  ./docker-manage.sh clean test   - Clean up test environment"
  echo "  ./docker-manage.sh publish      - Build and publish Docker image"
  echo ""
  exit 0
}

# Get the compose file for the chosen environment
function get_compose_file {
  local env=$1
  
  case $env in
    dev)
      echo "docker-compose.dev.yml"
      ;;
    test)
      echo "docker-compose.test.yml"
      ;;
    prod)
      echo "docker-compose.yml"
      ;;
    postgres)
      echo "docker-compose.postgres.yml"
      ;;
    health)
      echo "docker-compose.health-check.yml"
      ;;
    *)
      echo "docker-compose.dev.yml"
      ;;
  esac
}

# Start Docker containers
function start_containers {
  local env=$1
  local compose_file=$(get_compose_file $env)
  
  echo -e "${GREEN}Starting $env environment using $compose_file...${NC}"
  docker compose -f $compose_file up -d
  
  echo -e "${GREEN}Containers started successfully!${NC}"
  docker compose -f $compose_file ps
}

# Stop Docker containers
function stop_containers {
  local env=$1
  local compose_file=$(get_compose_file $env)
  
  echo -e "${YELLOW}Stopping $env environment...${NC}"
  docker compose -f $compose_file down
  
  echo -e "${GREEN}Containers stopped successfully!${NC}"
}

# Restart Docker containers
function restart_containers {
  local env=$1
  local compose_file=$(get_compose_file $env)
  
  echo -e "${YELLOW}Restarting $env environment...${NC}"
  docker compose -f $compose_file restart
  
  echo -e "${GREEN}Containers restarted successfully!${NC}"
  docker compose -f $compose_file ps
}

# Show logs from containers
function show_logs {
  local env=$1
  local compose_file=$(get_compose_file $env)
  
  echo -e "${BLUE}Showing logs from $env environment...${NC}"
  docker compose -f $compose_file logs -f
}

# Clean up Docker resources
function clean_resources {
  local env=$1
  local compose_file=$(get_compose_file $env)
  
  echo -e "${YELLOW}Cleaning up $env environment...${NC}"
  docker compose -f $compose_file down -v --remove-orphans
  
  echo -e "${GREEN}Clean up completed successfully!${NC}"
}

# Build Docker images
function build_images {
  local env=$1
  local compose_file=$(get_compose_file $env)
  
  echo -e "${BLUE}Building Docker images for $env environment...${NC}"
  docker compose -f $compose_file build
  
  echo -e "${GREEN}Build completed successfully!${NC}"
}

# Run tests in Docker containers
function run_tests {
  echo -e "${BLUE}Running tests in Docker...${NC}"
  ./scripts/run-docker-tests.sh --all --clean
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Tests completed successfully!${NC}"
  else
    echo -e "${RED}Tests failed!${NC}"
    exit 1
  fi
}

# Build and publish Docker image
function publish_image {
  local current_version=$(node -e "console.log(require('./package.json').version)")
  
  echo -e "${BLUE}Building and publishing Docker image version $current_version...${NC}"
  
  # Build the image
  docker build -t sparesparrow/mcp-prompts:$current_version -t sparesparrow/mcp-prompts:latest .
  
  # Publish to Docker Hub
  echo -e "${YELLOW}Pushing images to Docker Hub...${NC}"
  docker push sparesparrow/mcp-prompts:$current_version
  docker push sparesparrow/mcp-prompts:latest
  
  echo -e "${GREEN}Docker image published successfully!${NC}"
}

# Main function
function main {
  local command=${1:-help}
  local environment=${2:-dev}
  
  case $command in
    start)
      start_containers $environment
      ;;
    stop)
      stop_containers $environment
      ;;
    restart)
      restart_containers $environment
      ;;
    logs)
      show_logs $environment
      ;;
    clean)
      clean_resources $environment
      ;;
    build)
      build_images $environment
      ;;
    test)
      run_tests
      ;;
    publish)
      publish_image
      ;;
    help|*)
      show_help
      ;;
  esac
}

# Run main function with all arguments
main "$@" 