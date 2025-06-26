#!/bin/bash
# Docker Configuration Consolidation Script
# This script consolidates and simplifies Docker configurations for MCP Prompts

set -e

# Change to the project root directory
cd "$(dirname "$0")/../.."
ROOT_DIR=$(pwd)

echo "=== MCP Prompts Docker Consolidation ==="
echo "Consolidating Docker configurations..."

# Create backup directory
BACKUP_DIR="docker/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Backup current Docker files
echo "Backing up current Docker files..."
cp -r docker/Dockerfile.* "$BACKUP_DIR/"
cp -r docker/docker-compose.*.yml "$BACKUP_DIR/"
cp docker-compose.yml "$BACKUP_DIR/"

# Consolidate Dockerfiles
echo "Consolidating Dockerfiles..."

# Create a modern multi-stage Dockerfile
cat > docker/Dockerfile << 'EOF'
# Multi-stage Dockerfile for MCP Prompts
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Install utilities
RUN apk --no-cache add curl wget bash

# Create data directories
RUN mkdir -p /app/data/prompts /app/data/backups /app/data/rules && \
    touch /app/data/prompts/.keep /app/data/backups/.keep /app/data/rules/.keep && \
    chmod -R 755 /app/data

# Copy health check script
COPY docker/health-check.sh /health-check.sh
RUN chmod +x /health-check.sh

# Copy built files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Health check
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD /health-check.sh

# Set non-root user
USER node

# Default ports
EXPOSE 3000-3005

# Default command
CMD ["node", "dist/index.js"]
EOF

# Create a development-specific Dockerfile
cat > docker/Dockerfile.dev << 'EOF'
# Development Dockerfile for MCP Prompts
FROM node:20-alpine

WORKDIR /app

# Install utilities and development tools
RUN apk --no-cache add curl wget bash git

# Create data directories
RUN mkdir -p /app/data/prompts /app/data/backups /app/data/rules && \
    chmod -R 777 /app/data

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy health check script
COPY docker/health-check.sh /health-check.sh
RUN chmod +x /health-check.sh

# Health check
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD /health-check.sh

# Default ports
EXPOSE 3000-3005 9229

# Default command with hot reloading
CMD ["npm", "run", "dev:watch"]
EOF

# Create a test-specific Dockerfile
cat > docker/Dockerfile.test << 'EOF'
# Testing Dockerfile for MCP Prompts
FROM node:20-alpine

WORKDIR /app

# Install utilities and testing tools
RUN apk --no-cache add curl wget bash git

# Environment variable for testing
ENV NODE_ENV=test

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Set up test directories
RUN mkdir -p coverage

# Copy source and test files
COPY . .

# Run tests
CMD ["npm", "run", "test"]
EOF

# Consolidate docker-compose files
echo "Consolidating docker-compose files..."

# Create a base docker-compose.yml file
cat > docker-compose.yml << 'EOF'
# Base Docker Compose file for MCP Prompts
# This file provides the foundational configuration

version: '3.8'

name: mcp-prompts

services:
  # MCP Prompts Server with File Storage (default)
  mcp-prompts:
    build:
      context: .
      dockerfile: docker/Dockerfile
    image: sparesparrow/mcp-prompts:latest
    container_name: mcp-prompts
    environment:
      - NODE_ENV=production
      - STORAGE_TYPE=file
      - PROMPTS_DIR=/app/data/prompts
      - BACKUPS_DIR=/app/data/backups
      - LOG_LEVEL=info
      - HTTP_SERVER=true
      - PORT=3003
      - HOST=0.0.0.0
    volumes:
      - mcp-data:/app/data
    ports:
      - "3003:3003"
    healthcheck:
      test: ["CMD-SHELL", "/health-check.sh"]
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped
    networks:
      - mcp-network

volumes:
  mcp-data:
    name: mcp-prompts-data

networks:
  mcp-network:
    name: mcp-network
    driver: bridge
EOF

# Create a PostgreSQL compose file
cat > docker/docker-compose.postgres.yml << 'EOF'
# PostgreSQL extension for MCP Prompts
version: '3.8'

services:
  # PostgreSQL database
  postgres:
    image: postgres:14-alpine
    container_name: mcp-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mcp_prompts
    ports:
      - "5442:5432"  # External port 5442 maps to internal port 5432
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - mcp-network

  # MCP Prompts with PostgreSQL storage
  mcp-prompts-postgres:
    image: sparesparrow/mcp-prompts:latest
    container_name: mcp-prompts-postgres
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - STORAGE_TYPE=postgres
      - POSTGRES_HOST=postgres
      - POSTGRES_PORT=5432
      - POSTGRES_DATABASE=mcp_prompts
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_SSL=false
      - LOG_LEVEL=info
      - HTTP_SERVER=true
      - PORT=3004
      - HOST=0.0.0.0
    volumes:
      - mcp-postgres-data:/app/data
    ports:
      - "3004:3004"
    healthcheck:
      test: ["CMD-SHELL", "/health-check.sh"]
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped
    networks:
      - mcp-network

  # Adminer for PostgreSQL management
  adminer:
    image: adminer:latest
    container_name: mcp-adminer
    depends_on:
      - postgres
    ports:
      - "8080:8080"
    restart: unless-stopped
    networks:
      - mcp-network

volumes:
  postgres_data:
    name: mcp-postgres-data
  mcp-postgres-data:
    name: mcp-prompts-postgres-data

EOF

# Create a development compose file
cat > docker/docker-compose.dev.yml << 'EOF'
# Development configuration for MCP Prompts
version: '3.8'

services:
  # Development MCP Prompts Server
  mcp-prompts-dev:
    build:
      context: .
      dockerfile: docker/Dockerfile.dev
    image: sparesparrow/mcp-prompts:dev
    container_name: mcp-prompts-dev
    environment:
      - NODE_ENV=development
      - STORAGE_TYPE=file
      - PROMPTS_DIR=/app/data/prompts
      - BACKUPS_DIR=/app/data/backups
      - LOG_LEVEL=debug
      - HTTP_SERVER=true
      - PORT=3003
      - HOST=0.0.0.0
    volumes:
      - .:/app
      - node_modules:/app/node_modules
      - mcp-dev-data:/app/data
    ports:
      - "3003:3003"
      - "9229:9229"
    command: npm run dev:watch
    restart: unless-stopped
    networks:
      - mcp-network

  # PostgreSQL for development
  postgres-dev:
    image: postgres:14-alpine
    container_name: mcp-postgres-dev
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mcp_prompts_dev
    ports:
      - "5442:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - mcp-network

volumes:
  node_modules:
  mcp-dev-data:
  postgres_dev_data:

EOF

# Create a test compose file
cat > docker/docker-compose.test.yml << 'EOF'
# Testing configuration for MCP Prompts
version: '3.8'

services:
  # Unit tests
  mcp-unit-tests:
    build:
      context: .
      dockerfile: docker/Dockerfile.test
    image: sparesparrow/mcp-prompts:test
    container_name: mcp-unit-tests
    environment:
      - NODE_ENV=test
    volumes:
      - ./coverage:/app/coverage
    command: npm run test:unit
    networks:
      - mcp-network

  # Integration tests
  mcp-integration-tests:
    build:
      context: .
      dockerfile: docker/Dockerfile.test
    image: sparesparrow/mcp-prompts:test
    container_name: mcp-integration-tests
    environment:
      - NODE_ENV=test
      - PG_HOST=postgres-test
      - PG_PORT=5432
      - PG_USER=postgres
      - PG_PASSWORD=postgres
      - PG_DATABASE=mcp_prompts_test
      - DOCKER_TEST=true
    volumes:
      - ./coverage:/app/coverage
    command: npm run test:integration
    depends_on:
      postgres-test:
        condition: service_healthy
    networks:
      - mcp-network

  # PostgreSQL for tests
  postgres-test:
    image: postgres:14-alpine
    container_name: mcp-postgres-test
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mcp_prompts_test
    volumes:
      - postgres_test_data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - mcp-network

  # Health check tests
  mcp-health-check-tests:
    build:
      context: .
      dockerfile: docker/Dockerfile.test
    image: sparesparrow/mcp-prompts:test
    container_name: mcp-health-check-tests
    environment:
      - NODE_ENV=test
      - TEST_DOCKER_HEALTH=true
    volumes:
      - ./coverage:/app/coverage
    command: npm run test -- tests/integration/docker-health-check.test.ts
    profiles:
      - health-check
    networks:
      - mcp-network

volumes:
  postgres_test_data:

EOF

# Create a new integration compose file for multiple MCP servers
cat > docker/docker-compose.integration.yml << 'EOF'
# Integration with multiple MCP servers
version: '3.8'

services:
  # MCP Prompts with File Storage
  mcp-prompts-file:
    image: sparesparrow/mcp-prompts:latest
    container_name: mcp-prompts-file
    environment:
      - NODE_ENV=production
      - STORAGE_TYPE=file
      - PROMPTS_DIR=/app/data/prompts
      - LOG_LEVEL=info
      - HTTP_SERVER=true
      - PORT=3003
      - HOST=0.0.0.0
    volumes:
      - mcp-file-data:/app/data
    ports:
      - "3003:3003"
    restart: unless-stopped
    networks:
      - mcp-network

  # MCP Memory Server
  mcp-memory:
    image: node:20-alpine
    container_name: mcp-memory
    command: npx -y @modelcontextprotocol/server-memory
    ports:
      - "3010:3000"
    networks:
      - mcp-network

  # MCP GitHub Server
  mcp-github:
    image: node:20-alpine
    container_name: mcp-github
    command: >
      sh -c "
        echo 'Installing MCP GitHub Server...' &&
        npx -y @modelcontextprotocol/server-github
      "
    environment:
      - GITHUB_PERSONAL_ACCESS_TOKEN=${GITHUB_TOKEN:-}
    ports:
      - "3011:3000"
    networks:
      - mcp-network

volumes:
  mcp-file-data:
    name: mcp-prompts-file-data
EOF

# Update scripts/publish-images.sh
echo "Updating Docker publication script..."
cat > docker/scripts/publish-images.sh << 'EOF'
#!/bin/bash
# Script to build and publish Docker images for MCP Prompts

set -e

# Change to the project root directory
cd "$(dirname "$0")/../.."
ROOT_DIR=$(pwd)

# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")
REPO="sparesparrow/mcp-prompts"

echo "=== Building and Publishing MCP Prompts Docker Images ==="
echo "Version: $VERSION"

# Build and push the main image
echo "Building main image..."
docker build -t $REPO:latest -t $REPO:$VERSION -f docker/Dockerfile .
echo "Publishing main image..."
docker push $REPO:latest
docker push $REPO:$VERSION

# Build and push the development image
echo "Building development image..."
docker build -t $REPO:dev -f docker/Dockerfile.dev .
echo "Publishing development image..."
docker push $REPO:dev

# Build and push the test image
echo "Building test image..."
docker build -t $REPO:test -f docker/Dockerfile.test .
echo "Publishing test image..."
docker push $REPO:test

echo "All images built and published successfully!"
EOF
chmod +x docker/scripts/publish-images.sh

# Update package.json scripts
echo "Updating package.json scripts..."
# This would be better done with jq, but using sed for simplicity
sed -i 's|"docker:build":.*|"docker:build": "docker build -t sparesparrow/mcp-prompts:latest -f docker/Dockerfile ."|' package.json
sed -i 's|"docker:up":.*|"docker:up": "docker compose up -d"|' package.json
sed -i 's|"docker:dev:up":.*|"docker:dev:up": "docker compose -f docker-compose.yml -f docker/docker-compose.dev.yml up -d"|' package.json
sed -i 's|"docker:test:up":.*|"docker:test:up": "docker compose -f docker-compose.yml -f docker/docker-compose.test.yml up -d"|' package.json
sed -i 's|"docker:cleanup":.*|"docker:cleanup": "./docker/scripts/cleanup-docker-files.sh"|' package.json

# Add new scripts for the consolidated Docker setup
cat >> package.json.tmp << 'EOF'
  "scripts": {
    ...
    "docker:postgres:up": "docker compose -f docker-compose.yml -f docker/docker-compose.postgres.yml up -d",
    "docker:postgres:down": "docker compose -f docker-compose.yml -f docker/docker-compose.postgres.yml down",
    "docker:integration:up": "docker compose -f docker-compose.yml -f docker/docker-compose.integration.yml up -d",
    "docker:integration:down": "docker compose -f docker-compose.yml -f docker/docker-compose.integration.yml down",
    "docker:publish:all": "./docker/scripts/publish-images.sh",
    "docker:consolidate": "./docker/scripts/consolidate-docker.sh",
    ...
EOF

echo "Consolidation complete!"
echo "Please manually verify the changes to package.json and adjust as needed."
echo "You can run the consolidated Docker setup with: docker compose up -d"
echo "Or with PostgreSQL: docker compose -f docker-compose.yml -f docker/docker-compose.postgres.yml up -d" 