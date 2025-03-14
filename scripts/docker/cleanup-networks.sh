#!/usr/bin/env bash

# Docker Network and Volume Cleanup Script
# This script helps clean up Docker networks and volumes before running Docker Compose

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

# Parse command line arguments
CLEAN_VOLUMES=false
FORCE_MODE=false

for arg in "$@"; do
  case $arg in
    --volumes)
      CLEAN_VOLUMES=true
      shift
      ;;
    --force|-f)
      FORCE_MODE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --volumes    Also clean up Docker volumes"
      echo "  --force, -f  Force cleanup without asking for confirmation"
      echo "  --help, -h   Show this help message"
      exit 0
      ;;
  esac
done

# Check if Docker is running
if ! docker info &> /dev/null; then
  print_error "Docker daemon is not running. Please start Docker."
  exit 1
fi

print_step "Starting Docker cleanup process..."

# Network cleanup
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
  if [ "$FORCE_MODE" = true ]; then
    REPLY="y"
  else
    read -p "Do you want to remove these networks? (y/n) " -n 1 -r
    echo
  fi
  
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

print_success "Network cleanup complete"

# Volume cleanup if requested
if [ "$CLEAN_VOLUMES" = true ]; then
  print_step "Checking Docker volumes..."
  
  # List all volumes
  VOLUMES=$(docker volume ls -q)
  VOLUME_COUNT=$(echo "$VOLUMES" | wc -l)
  
  print_step "Found $VOLUME_COUNT volumes"
  
  # Prune unused volumes
  print_step "Pruning unused volumes..."
  
  if [ "$FORCE_MODE" = true ]; then
    PRUNED_VOLUMES=$(docker volume prune -f)
  else
    read -p "Do you want to prune unused volumes? This will remove all volumes not used by at least one container. (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      PRUNED_VOLUMES=$(docker volume prune -f)
    fi
  fi
  
  if [[ -n "$PRUNED_VOLUMES" && "$PRUNED_VOLUMES" != *"Total reclaimed space: 0B"* ]]; then
    print_success "Successfully pruned unused volumes"
  else
    print_warning "No volumes were pruned"
  fi
  
  # Check for MCP-specific volumes
  MCP_VOLUMES=$(docker volume ls --format "{{.Name}}" | grep -E "mcp|prompts|postgres")
  if [[ -n "$MCP_VOLUMES" ]]; then
    print_warning "The following MCP-related volumes remain:"
    echo "$MCP_VOLUMES"
    
    # Ask if user wants to remove them
    if [ "$FORCE_MODE" = true ]; then
      REPLY="y"
    else
      read -p "Do you want to remove these MCP-related volumes? (y/n) " -n 1 -r
      echo
    fi
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      for VOLUME in $MCP_VOLUMES; do
        if docker volume rm "$VOLUME" &> /dev/null; then
          print_success "Removed volume: $VOLUME"
        else
          print_warning "Could not remove volume: $VOLUME (it may be in use)"
        fi
      done
    fi
  else
    print_success "No MCP-specific volumes found"
  fi
  
  print_success "Volume cleanup complete"
fi

print_step "Docker cleanup process finished successfully"

# Return success
exit 0 