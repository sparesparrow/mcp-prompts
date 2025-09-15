# Legacy Docker Files

This directory contains legacy Docker files that have been replaced by the standardized Docker setup.

## Directory Structure

Each timestamp directory contains files that were moved during a cleanup operation.

## Current Docker Setup

The current Docker setup uses the following structure:

- `docker/Dockerfile.prod`: Production Docker image
- `docker/Dockerfile.development`: Development Docker image with hot-reloading
- `docker/Dockerfile.testing`: Testing Docker image

Docker Compose files are organized in the `docker/compose/` directory:

- `docker-compose.base.yml`: Base configuration
- `docker-compose.development.yml`: Development environment
- `docker-compose.test.yml`: Testing environment
- `docker-compose.postgres.yml`: PostgreSQL integration
- `docker-compose.pgai.yml`: PGAI integration
- `docker-compose.sse.yml`: SSE support
- `docker-compose.integration.yml`: Multi-server integration

Use the `docker/scripts/docker-compose-manager.sh` script to manage Docker Compose.
