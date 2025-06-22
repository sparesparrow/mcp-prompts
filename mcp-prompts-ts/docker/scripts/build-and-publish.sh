#!/bin/bash

# Script to build and publish multi-architecture Docker images.
# It builds and publishes images for production, development, and testing
# for linux/amd64 and linux/arm64 architectures.

set -e

# --- Configuration ---
DOCKER_REPO="sparesparrow/mcp-prompts"
PLATFORMS="linux/amd64,linux/arm64"

# --- Colors ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- Helper Functions ---
function get_version_tag() {
    if [ -n "$1" ]; then
        echo "$1"
    else
        local git_tag
        git_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
        if [ -n "$git_tag" ]; then
            echo "${git_tag#v}" # Remove 'v' prefix
        else
            echo "latest"
        fi
    fi
}

function check_docker_login() {
    if ! docker info | grep -q "Username:"; then
        echo -e "${YELLOW}You are not logged into Docker Hub. Please run 'docker login' first.${NC}"
        exit 1
    fi
}

# --- Main Script ---
TAG=$(get_version_tag "$1")
echo -e "${BLUE}Building and publishing multi-arch Docker images for repository: ${YELLOW}${DOCKER_REPO}${NC} with tag: ${YELLOW}${TAG}${NC}"

check_docker_login

# Ensure the buildx builder is available
if ! docker buildx ls | grep -q "default"; then
  echo -e "${BLUE}Creating a new buildx builder instance.${NC}"
  docker buildx create --use --name default-builder
fi

# Build and push production image
echo -e "${GREEN}Building and pushing production image...${NC}"
docker buildx build --platform "$PLATFORMS" \
  -t "${DOCKER_REPO}:${TAG}" \
  -t "${DOCKER_REPO}:latest" \
  -f docker/Dockerfile.prod --push .

# Build and push development image
echo -e "${GREEN}Building and pushing development image...${NC}"
docker buildx build --platform "$PLATFORMS" \
  -t "${DOCKER_REPO}:${TAG}-dev" \
  -t "${DOCKER_REPO}:dev" \
  -f docker/Dockerfile.development --push .

# Build and push testing image
echo -e "${GREEN}Building and pushing testing image...${NC}"
docker buildx build --platform "$PLATFORMS" \
  -t "${DOCKER_REPO}:${TAG}-test" \
  -t "${DOCKER_REPO}:test" \
  -f docker/Dockerfile.testing --push .


echo -e "${GREEN}Images published successfully:${NC}"
echo " - ${DOCKER_REPO}:${TAG}"
echo " - ${DOCKER_REPO}:latest"
echo " - ${DOCKER_REPO}:${TAG}-dev"
echo " - ${DOCKER_REPO}:dev"
echo " - ${DOCKER_REPO}:${TAG}-test"
echo " - ${DOCKER_REPO}:test" 