#!/bin/bash
# MCP Prompts Docker Environment Cleanup Script

echo "=== MCP Prompts Docker Cleanup ==="
echo "Stopping all running containers..."
docker compose down

echo "Removing all MCP Prompts containers..."
docker rm -f $(docker ps -a | grep mcp-prompts | awk '{print $1}') 2>/dev/null || true

echo "Removing stale Docker networks..."
docker network prune -f

echo "Cleaning up dangling images..."
docker image prune -f

echo "Listing existing volumes (not removing):"
docker volume ls | grep mcp

echo "=== Cleanup Complete ==="
echo "To remove volumes, use: docker volume rm <volume_name>"
echo "To remove all unused volumes: docker volume prune" 