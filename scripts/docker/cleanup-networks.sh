#!/usr/bin/env bash

# Docker Network Cleanup Script
# This script helps clean up Docker networks before running Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
  echo -e "${BLUE}🔹 $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is running
if ! docker info &> /dev/null; then
  print_error "Docker daemon is not running. Please start Docker."
  exit 1
fi

print_step "Checking Docker networks..."

# List all networks
NETWORKS=$(docker network ls -q)
NETWORK_COUNT=$(echo "$NETWORKS" | wc -l)

print_step "Found $NETWORK_COUNT networks"

# Prune unused networks
print_step "Pruning unused networks..."
PRUNED=$(docker network prune -f)

if [[ $PRUNED == *"Total reclaimed space: 0B"* ]]; then
  print_warning "No networks were pruned"
else
  print_success "Successfully pruned unused networks"
fi

# Check for remaining networks
REMAINING_NETWORKS=$(docker network ls --format "{{.Name}}" | grep -v "bridge\|host\|none")
if [[ -n "$REMAINING_NETWORKS" ]]; then
  print_warning "The following custom networks remain:"
  echo "$REMAINING_NETWORKS"
  
  # Ask if user wants to remove them
  read -p "Do you want to remove these networks? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    for NETWORK in $REMAINING_NETWORKS; do
      if docker network rm "$NETWORK" &> /dev/null; then
        print_success "Removed network: $NETWORK"
      else
        print_warning "Could not remove network: $NETWORK (it may be in use)"
      fi
    done
  fi
else
  print_success "No custom networks found"
fi

print_step "Network cleanup complete"

# Return success
exit 0 