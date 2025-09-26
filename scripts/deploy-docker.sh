#!/bin/bash

set -e

echo "🐳 Deploying MCP-Prompts with Docker"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="${IMAGE_NAME:-sparesparrow/mcp-prompts}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-docker.io}"
STORAGE_TYPE="${STORAGE_TYPE:-memory}"
PORT="${PORT:-3000}"
HOST="${HOST:-0.0.0.0}"

echo -e "${BLUE}🔧 Configuration:${NC}"
echo -e "  Image Name: ${YELLOW}$IMAGE_NAME${NC}"
echo -e "  Image Tag: ${YELLOW}$IMAGE_TAG${NC}"
echo -e "  Registry: ${YELLOW}$REGISTRY${NC}"
echo -e "  Storage Type: ${YELLOW}$STORAGE_TYPE${NC}"
echo -e "  Port: ${YELLOW}$PORT${NC}"
echo -e "  Host: ${YELLOW}$HOST${NC}"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install it first.${NC}"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker Compose not found. Installing...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y docker-compose
    elif command -v yum &> /dev/null; then
        sudo yum install -y docker-compose
    elif command -v brew &> /dev/null; then
        brew install docker-compose
    else
        echo -e "${RED}❌ Cannot install Docker Compose. Please install it manually.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Build the project
echo "🔨 Building project..."
pnpm install
pnpm run build

# Create optimized Dockerfile for different storage types
echo "📝 Creating Dockerfiles for different storage types..."

# Memory Storage Dockerfile
cat > Dockerfile.memory <<EOF
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm fetch

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/ /app/
COPY . .
RUN corepack enable && pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV STORAGE_TYPE=memory
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/data ./data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD wget --no-verbose --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/mcp-server-standalone.js"]
EOF

# File Storage Dockerfile
cat > Dockerfile.file <<EOF
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm fetch

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/ /app/
COPY . .
RUN corepack enable && pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV STORAGE_TYPE=file
ENV PROMPTS_DIR=/app/data/prompts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/data ./data
RUN mkdir -p /app/data/prompts
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD wget --no-verbose --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/mcp-server-standalone.js"]
EOF

# PostgreSQL Dockerfile
cat > Dockerfile.postgres <<EOF
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm fetch

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/ /app/
COPY . .
RUN corepack enable && pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV STORAGE_TYPE=postgres
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/data ./data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD wget --no-verbose --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/mcp-server-standalone.js"]
EOF

# AWS Dockerfile
cat > Dockerfile.aws <<EOF
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm fetch

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/ /app/
COPY . .
RUN corepack enable && pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV STORAGE_TYPE=aws
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/data ./data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD wget --no-verbose --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/mcp-server-standalone.js"]
EOF

echo -e "${GREEN}✅ Dockerfiles created${NC}"

# Build Docker images
echo "🐳 Building Docker images..."

# Build memory storage image
echo "Building memory storage image..."
docker build -f Dockerfile.memory -t "$IMAGE_NAME:memory" .

# Build file storage image
echo "Building file storage image..."
docker build -f Dockerfile.file -t "$IMAGE_NAME:file" .

# Build PostgreSQL image
echo "Building PostgreSQL image..."
docker build -f Dockerfile.postgres -t "$IMAGE_NAME:postgres" .

# Build AWS image
echo "Building AWS image..."
docker build -f Dockerfile.aws -t "$IMAGE_NAME:aws" .

# Tag with latest
docker tag "$IMAGE_NAME:$STORAGE_TYPE" "$IMAGE_NAME:$IMAGE_TAG"

echo -e "${GREEN}✅ Docker images built${NC}"

# Create docker-compose files for different scenarios
echo "📝 Creating docker-compose configurations..."

# Memory storage compose
cat > docker-compose.memory.yml <<EOF
version: '3.8'

services:
  mcp-prompts:
    image: $IMAGE_NAME:memory
    container_name: mcp-prompts-memory
    ports:
      - "$PORT:3000"
    environment:
      - NODE_ENV=production
      - STORAGE_TYPE=memory
      - LOG_LEVEL=$LOG_LEVEL
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
EOF

# File storage compose
cat > docker-compose.file.yml <<EOF
version: '3.8'

services:
  mcp-prompts:
    image: $IMAGE_NAME:file
    container_name: mcp-prompts-file
    ports:
      - "$PORT:3000"
    environment:
      - NODE_ENV=production
      - STORAGE_TYPE=file
      - PROMPTS_DIR=/app/data/prompts
      - LOG_LEVEL=$LOG_LEVEL
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
EOF

# PostgreSQL compose
cat > docker-compose.postgres.yml <<EOF
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: mcp-prompts-postgres
    environment:
      - POSTGRES_DB=mcp_prompts
      - POSTGRES_USER=mcp_user
      - POSTGRES_PASSWORD=mcp_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/create-postgres-schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./scripts/insert-sample-data.sql:/docker-entrypoint-initdb.d/02-data.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mcp_user -d mcp_prompts"]
      interval: 10s
      timeout: 5s
      retries: 5

  mcp-prompts:
    image: $IMAGE_NAME:postgres
    container_name: mcp-prompts-app
    ports:
      - "$PORT:3000"
    environment:
      - NODE_ENV=production
      - STORAGE_TYPE=postgres
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=mcp_prompts
      - DB_USER=mcp_user
      - DB_PASSWORD=mcp_password
      - LOG_LEVEL=$LOG_LEVEL
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
EOF

# AWS compose (for local development with AWS credentials)
cat > docker-compose.aws.yml <<EOF
version: '3.8'

services:
  mcp-prompts:
    image: $IMAGE_NAME:aws
    container_name: mcp-prompts-aws
    ports:
      - "$PORT:3000"
    environment:
      - NODE_ENV=production
      - STORAGE_TYPE=aws
      - AWS_REGION=\${AWS_REGION:-us-east-1}
      - AWS_ACCESS_KEY_ID=\${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=\${AWS_SECRET_ACCESS_KEY}
      - PROMPTS_TABLE=\${PROMPTS_TABLE:-mcp-prompts}
      - PROMPTS_BUCKET=\${PROMPTS_BUCKET:-mcp-prompts-catalog}
      - PROCESSING_QUEUE=\${PROCESSING_QUEUE}
      - LOG_LEVEL=$LOG_LEVEL
    volumes:
      - ~/.aws:/root/.aws:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
EOF

echo -e "${GREEN}✅ Docker Compose files created${NC}"

# Create management scripts
echo "📝 Creating management scripts..."

# Start script
cat > ./scripts/docker-start.sh <<EOF
#!/bin/bash
STORAGE_TYPE=\${1:-memory}
echo "🐳 Starting MCP Prompts with $STORAGE_TYPE storage..."

case \$STORAGE_TYPE in
    memory)
        docker-compose -f docker-compose.memory.yml up -d
        ;;
    file)
        docker-compose -f docker-compose.file.yml up -d
        ;;
    postgres)
        docker-compose -f docker-compose.postgres.yml up -d
        ;;
    aws)
        docker-compose -f docker-compose.aws.yml up -d
        ;;
    *)
        echo "❌ Unknown storage type: \$STORAGE_TYPE"
        echo "Available types: memory, file, postgres, aws"
        exit 1
        ;;
esac

echo "✅ MCP Prompts started with $STORAGE_TYPE storage"
echo "🌐 Access at: http://localhost:$PORT"
echo "🏥 Health check: http://localhost:$PORT/health"
EOF

chmod +x ./scripts/docker-start.sh

# Stop script
cat > ./scripts/docker-stop.sh <<EOF
#!/bin/bash
STORAGE_TYPE=\${1:-memory}
echo "🛑 Stopping MCP Prompts with $STORAGE_TYPE storage..."

case \$STORAGE_TYPE in
    memory)
        docker-compose -f docker-compose.memory.yml down
        ;;
    file)
        docker-compose -f docker-compose.file.yml down
        ;;
    postgres)
        docker-compose -f docker-compose.postgres.yml down
        ;;
    aws)
        docker-compose -f docker-compose.aws.yml down
        ;;
    *)
        echo "❌ Unknown storage type: \$STORAGE_TYPE"
        echo "Available types: memory, file, postgres, aws"
        exit 1
        ;;
esac

echo "✅ MCP Prompts stopped"
EOF

chmod +x ./scripts/docker-stop.sh

# Logs script
cat > ./scripts/docker-logs.sh <<EOF
#!/bin/bash
STORAGE_TYPE=\${1:-memory}
echo "📋 Showing logs for MCP Prompts with $STORAGE_TYPE storage..."

case \$STORAGE_TYPE in
    memory)
        docker-compose -f docker-compose.memory.yml logs -f
        ;;
    file)
        docker-compose -f docker-compose.file.yml logs -f
        ;;
    postgres)
        docker-compose -f docker-compose.postgres.yml logs -f
        ;;
    aws)
        docker-compose -f docker-compose.aws.yml logs -f
        ;;
    *)
        echo "❌ Unknown storage type: \$STORAGE_TYPE"
        echo "Available types: memory, file, postgres, aws"
        exit 1
        ;;
esac
EOF

chmod +x ./scripts/docker-logs.sh

# Push script
cat > ./scripts/docker-push.sh <<EOF
#!/bin/bash
echo "📤 Pushing Docker images to registry..."

# Login to registry (if not already logged in)
if [ -n "\$REGISTRY_USERNAME" ] && [ -n "\$REGISTRY_PASSWORD" ]; then
    echo "🔐 Logging in to registry..."
    echo "\$REGISTRY_PASSWORD" | docker login --username "\$REGISTRY_USERNAME" --password-stdin "\$REGISTRY"
fi

# Push all images
docker push "$IMAGE_NAME:memory"
docker push "$IMAGE_NAME:file"
docker push "$IMAGE_NAME:postgres"
docker push "$IMAGE_NAME:aws"
docker push "$IMAGE_NAME:$IMAGE_TAG"

echo "✅ All images pushed to registry"
EOF

chmod +x ./scripts/docker-push.sh

# Cleanup script
cat > ./scripts/docker-cleanup.sh <<EOF
#!/bin/bash
echo "🧹 Cleaning up Docker resources..."

# Stop all containers
docker-compose -f docker-compose.memory.yml down 2>/dev/null || true
docker-compose -f docker-compose.file.yml down 2>/dev/null || true
docker-compose -f docker-compose.postgres.yml down 2>/dev/null || true
docker-compose -f docker-compose.aws.yml down 2>/dev/null || true

# Remove images
docker rmi "$IMAGE_NAME:memory" 2>/dev/null || true
docker rmi "$IMAGE_NAME:file" 2>/dev/null || true
docker rmi "$IMAGE_NAME:postgres" 2>/dev/null || true
docker rmi "$IMAGE_NAME:aws" 2>/dev/null || true
docker rmi "$IMAGE_NAME:$IMAGE_TAG" 2>/dev/null || true

# Remove unused images
docker image prune -f

echo "✅ Docker cleanup completed"
EOF

chmod +x ./scripts/docker-cleanup.sh

# Create environment file
echo "⚙️  Creating environment file..."
cat > .env.docker <<EOF
# MCP Prompts Docker Configuration
IMAGE_NAME=$IMAGE_NAME
IMAGE_TAG=$IMAGE_TAG
REGISTRY=$REGISTRY
STORAGE_TYPE=$STORAGE_TYPE
PORT=$PORT
HOST=$HOST
LOG_LEVEL=$LOG_LEVEL
NODE_ENV=production
EOF

echo ""
echo -e "${GREEN}🎉 Docker Deployment Completed!${NC}"
echo ""
echo -e "${GREEN}📊 Deployment Summary:${NC}"
echo -e "  Image Name: ${YELLOW}$IMAGE_NAME${NC}"
echo -e "  Image Tag: ${YELLOW}$IMAGE_TAG${NC}"
echo -e "  Registry: ${YELLOW}$REGISTRY${NC}"
echo -e "  Storage Types: ${YELLOW}memory, file, postgres, aws${NC}"
echo -e "  Port: ${YELLOW}$PORT${NC}"
echo -e "  Host: ${YELLOW}$HOST${NC}"
echo ""
echo -e "${GREEN}🚀 Start Commands:${NC}"
echo -e "  Memory:      ${YELLOW}./scripts/docker-start.sh memory${NC}"
echo -e "  File:        ${YELLOW}./scripts/docker-start.sh file${NC}"
echo -e "  PostgreSQL:  ${YELLOW}./scripts/docker-start.sh postgres${NC}"
echo -e "  AWS:         ${YELLOW}./scripts/docker-start.sh aws${NC}"
echo ""
echo -e "${GREEN}🔧 Management Commands:${NC}"
echo -e "  Stop:        ${YELLOW}./scripts/docker-stop.sh <storage-type>${NC}"
echo -e "  Logs:        ${YELLOW}./scripts/docker-logs.sh <storage-type>${NC}"
echo -e "  Push:        ${YELLOW}./scripts/docker-push.sh${NC}"
echo -e "  Cleanup:     ${YELLOW}./scripts/docker-cleanup.sh${NC}"
echo ""
echo -e "${GREEN}📝 Next Steps:${NC}"
echo "1. Start with memory storage: ./scripts/docker-start.sh memory"
echo "2. Test the service: curl http://localhost:$PORT/health"
echo "3. Push to registry: ./scripts/docker-push.sh"
echo "4. Set up production deployment with your preferred storage type"
echo "5. Configure monitoring and logging"
echo "6. Set up CI/CD pipeline for automated builds"
