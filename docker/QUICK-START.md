# MCP Prompts Docker Quick-Start Guide

This guide provides a quick overview of how to get started with MCP Prompts using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose installed on your system

## Quick Start

### 1. Basic Deployment (File Storage)

```bash
# Clone the repository
git clone https://github.com/sparesparrow/mcp-prompts.git
cd mcp-prompts

# Start the MCP Prompts server
./docker/scripts/docker-compose-manager.sh up
```

This will start the MCP Prompts server with file storage on port 3003.

### 2. PostgreSQL Backend

```bash
# Start with PostgreSQL database
./docker/scripts/docker-compose-manager.sh up -p postgres
```

This adds a PostgreSQL database for persistent storage.

### 3. Development Environment

```bash
# Start development environment with hot-reloading
./docker/scripts/docker-compose-manager.sh up -e development
```

This starts a development server with hot-reloading on port 3004.

### 4. Full Integration Environment

```bash
# Start with multiple MCP servers integration
./docker/scripts/docker-compose-manager.sh up -p integration
```

This sets up multiple MCP servers for integration.

## Useful Commands

### Checking Server Status

```bash
# Check running containers
docker compose ps
```

### Viewing Logs

```bash
# View logs from all containers
docker compose logs

# View logs from a specific container
docker compose logs mcp-prompts
```

### Stopping Containers

```bash
# Stop all containers
./docker/scripts/docker-compose-manager.sh down

# Stop and remove volumes
./docker/scripts/docker-compose-manager.sh down -v
```

## Environment Variables

You can customize the deployment by setting environment variables in a `.env` file:

```
# Storage type (file or postgres)
STORAGE_TYPE=file

# Directory for storing prompts
PROMPTS_DIR=/app/data/prompts

# Directory for storing backups
BACKUPS_DIR=/app/data/backups

# Log level
LOG_LEVEL=info
```

## Using with Claude Desktop

1. Start the MCP Prompts server:

   ```bash
   ./docker/scripts/docker-compose-manager.sh up
   ```

2. Configure Claude Desktop to use MCP Prompts:

   - Open Claude Desktop settings
   - Go to "MCP Servers"
   - Add a new server with:
     - Name: MCP Prompts
     - URL: http://localhost:3003

3. You can now use prompts from the MCP Prompts server in Claude Desktop by typing "/" in the chat.

## Next Steps

For more detailed information about Docker deployment options, please refer to the comprehensive [Docker documentation](./README.md).
