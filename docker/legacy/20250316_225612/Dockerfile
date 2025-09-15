# Multi-stage Dockerfile for MCP Prompts
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Disable prepare script temporarily to prevent build during install
RUN npm pkg delete scripts.prepare && \
    npm install

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/
# Build the application
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
COPY --from=deps /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules

# Health check
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD /health-check.sh

# Set non-root user
USER node

# Default ports
EXPOSE 3000-3005

# Default command
CMD ["node", "dist/index.js"]
