# Docker Configuration for MCP Prompts Server

This directory contains Docker configuration files for the MCP Prompts Server.

## Docker Files

- `Dockerfile` - Main Dockerfile for production use (located in root directory)
- `Dockerfile.test` - Dockerfile for testing the package with npx
- `Dockerfile.setup` - Dockerfile for setting up the environment, including PostgreSQL

## Docker Compose Files

- `docker-compose.yml` - Standard configuration with file storage
- `docker-compose.postgres.yml` - Configuration using PostgreSQL for storage
- `docker-compose.dev.yml` - Development configuration with hot-reloading
- `docker-compose.test.yml` - Test configuration with MCP Inspector
- `docker-compose.setup.yml` - Setup configuration for initial environment setup

## Usage Examples

### Production Use with File Storage

```bash
docker-compose -f docker/docker-compose.yml up
```

### Production Use with PostgreSQL

```bash
docker-compose -f docker/docker-compose.postgres.yml up
```

### Development Environment

```bash
docker-compose -f docker/docker-compose.dev.yml up
```

### Testing with MCP Inspector

```bash
docker-compose -f docker/docker-compose.test.yml up
```

## Environment Variables

The Docker configurations support various environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_TYPE` | Storage type (file, postgres, memory) | file |
| `PROMPTS_DIR` | Directory for prompts | /app/data/prompts |
| `BACKUPS_DIR` | Directory for backups | /app/data/backups |
| `POSTGRES_CONNECTION_STRING` | PostgreSQL connection string | postgresql://postgres:postgres@postgres:5432/mcp_prompts |
| `LOG_LEVEL` | Logging level | info |
| `HTTP_SERVER` | Enable HTTP server | true |
| `PORT` | HTTP port | 3003 |
| `HOST` | HTTP host | 0.0.0.0 |

## Volumes

The Docker configurations use the following volumes:

- `mcp-prompts-data` - For storing prompts and backups
- `mcp-postgres-data` - For PostgreSQL data

## Health Checks

The Docker configurations include health checks to ensure that services are running correctly. These are used to determine when a service is ready for use by dependent services.

## Best Practices

- Use named volumes for data persistence
- Set resource limits for production use
- Use non-root users for security
- Implement proper health checks
- Pin specific versions of base images
- Use multi-stage builds to reduce image size
- Keep sensitive information in environment variables
- Use Docker secrets for sensitive information in production

## Scripts

The following scripts are available for working with Docker:

- `scripts/test/manual-docker-test.sh` - Interactive script for testing with Docker
- `scripts/test/test-docker-build.sh` - Automated test for Docker build
- `scripts/docker/cleanup-networks.sh` - Script for cleaning up Docker networks

## Troubleshooting

### Container fails to start

- Check the container logs: `docker logs <container_name>`
- Verify the environment variables are set correctly
- Ensure volumes have correct permissions

### Cannot connect to the HTTP server

- Verify the port mapping: `docker ps`
- Check if the health check is passing: `docker inspect <container_name> | grep Health`
- Ensure the HTTP server is enabled via the `HTTP_SERVER` environment variable

### PostgreSQL connection issues

- Check if PostgreSQL container is running: `docker ps`
- Verify PostgreSQL connection string
- Ensure PostgreSQL is healthy before starting dependent services 