#!/bin/bash

# Docker Compose Manager for MCP Prompts
# This script helps manage different Docker Compose configurations

set -e

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
COMPOSE_DIR="./docker/compose"
ENV="production"
PROFILES=""

# Help message
function show_help {
    echo -e "${BLUE}MCP Prompts Docker Compose Manager${NC}"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  up          Start services"
    echo "  down        Stop services"
    echo "  restart     Restart services"
    echo "  logs        View logs"
    echo "  ps          List running services"
    echo "  build       Build services"
    echo "  image       Build Docker image (prod, dev, test)"
    echo "  publish     Build and publish Docker images"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV       Environment (production, development, test) [default: production]"
    echo "  -p, --profile PROFILE   Add profile to selection (can be used multiple times)"
    echo "  -t, --tag TAG       Tag for Docker images when using 'image' or 'publish' commands"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Available profiles:"
    echo "  postgres      Include PostgreSQL database"
    echo "  adminer       Include Adminer database UI"
    echo "  pgai          Include PGAI integration"
    echo "  sse           Include SSE transport support"
    echo "  memory        Include MCP Memory server"
    echo "  github        Include MCP GitHub server"
    echo "  filesystem    Include MCP Filesystem server"
    echo "  integration   Full integration test environment"
    echo ""
    echo "Examples:"
    echo "  $0 up -e development -p postgres -p adminer"
    echo "  $0 down -e test"
    echo "  $0 logs -e production"
    echo "  $0 image -e production -t latest"
    exit 0
}

# Parse command line arguments
COMMAND=$1
shift || true

TAG="latest"

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENV="$2"
            shift 2
            ;;
        -p|--profile)
            if [[ -n "$PROFILES" ]]; then
                PROFILES="${PROFILES},${2}"
            else
                PROFILES="$2"
            fi
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}" >&2
            show_help
            ;;
    esac
done

# Validate environment
if [[ "$ENV" != "production" && "$ENV" != "development" && "$ENV" != "test" ]]; then
    echo -e "${RED}Error: Invalid environment. Use production, development, or test.${NC}" >&2
    exit 1
fi

# Build the docker-compose command
COMPOSE_FILES="-f ${COMPOSE_DIR}/docker-compose.base.yml"

# Add environment-specific compose file
if [[ "$ENV" != "production" ]]; then
    COMPOSE_FILES="$COMPOSE_FILES -f ${COMPOSE_DIR}/docker-compose.${ENV}.yml"
fi

# Add profile-specific compose files
if [[ "$PROFILES" == *"postgres"* ]]; then
    COMPOSE_FILES="$COMPOSE_FILES -f ${COMPOSE_DIR}/docker-compose.postgres.yml"
fi

if [[ "$PROFILES" == *"pgai"* ]]; then
    COMPOSE_FILES="$COMPOSE_FILES -f ${COMPOSE_DIR}/docker-compose.pgai.yml"
fi

if [[ "$PROFILES" == *"sse"* ]]; then
    COMPOSE_FILES="$COMPOSE_FILES -f ${COMPOSE_DIR}/docker-compose.sse.yml"
fi

if [[ "$PROFILES" == *"integration"* ]]; then
    COMPOSE_FILES="$COMPOSE_FILES -f ${COMPOSE_DIR}/docker-compose.integration.yml"
fi

# Execute command
case $COMMAND in
    up)
        echo -e "${GREEN}Starting MCP Prompts services (${YELLOW}${ENV}${GREEN})${NC}"
        if [[ -n "$PROFILES" ]]; then
            echo -e "${GREEN}With profiles: ${YELLOW}${PROFILES}${NC}"
            PROFILE_ARG="--profile $(echo $PROFILES | sed 's/,/ --profile /g')"
        else
            PROFILE_ARG=""
        fi
        
        docker compose $COMPOSE_FILES $PROFILE_ARG up -d
        ;;
    down)
        echo -e "${GREEN}Stopping MCP Prompts services${NC}"
        docker compose $COMPOSE_FILES down
        ;;
    restart)
        echo -e "${GREEN}Restarting MCP Prompts services${NC}"
        docker compose $COMPOSE_FILES restart
        ;;
    logs)
        echo -e "${GREEN}Showing logs for MCP Prompts services${NC}"
        docker compose $COMPOSE_FILES logs -f
        ;;
    ps)
        echo -e "${GREEN}Listing MCP Prompts services${NC}"
        docker compose $COMPOSE_FILES ps
        ;;
    build)
        echo -e "${GREEN}Building MCP Prompts services${NC}"
        docker compose $COMPOSE_FILES build
        ;;
    image)
        if [[ "$ENV" == "production" ]]; then
            echo -e "${GREEN}Building production Docker image with tag ${YELLOW}${TAG}${NC}"
            docker build -t sparesparrow/mcp-prompts:${TAG} -f docker/Dockerfile.prod .
        elif [[ "$ENV" == "development" ]]; then
            echo -e "${GREEN}Building development Docker image with tag ${YELLOW}${TAG}${NC}"
            docker build -t sparesparrow/mcp-prompts:${TAG}-dev -f docker/Dockerfile.development .
        elif [[ "$ENV" == "test" ]]; then
            echo -e "${GREEN}Building test Docker image with tag ${YELLOW}${TAG}${NC}"
            docker build -t sparesparrow/mcp-prompts:${TAG}-test -f docker/Dockerfile.testing .
        fi
        ;;
    publish)
        echo -e "${GREEN}Building and publishing Docker images with tag ${YELLOW}${TAG}${NC}"
        
        # Build images
        docker build -t sparesparrow/mcp-prompts:${TAG} -f docker/Dockerfile.prod .
        docker build -t sparesparrow/mcp-prompts:${TAG}-dev -f docker/Dockerfile.development .
        docker build -t sparesparrow/mcp-prompts:${TAG}-test -f docker/Dockerfile.testing .
        
        # Push images
        docker push sparesparrow/mcp-prompts:${TAG}
        docker push sparesparrow/mcp-prompts:${TAG}-dev
        docker push sparesparrow/mcp-prompts:${TAG}-test
        
        echo -e "${GREEN}Images published successfully${NC}"
        ;;
    *)
        echo -e "${RED}Error: Unknown command. Use up, down, restart, logs, ps, build, image, or publish.${NC}" >&2
        show_help
        ;;
esac
