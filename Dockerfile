FROM node:20-alpine AS build

WORKDIR /app

# Set env to indicate Docker build
ENV DOCKER_BUILD=true

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Handle dependency discrepancies by using a more robust installation approach
RUN npm ci --no-package-lock && \
    npm install --no-save @modelcontextprotocol/sdk@1.6.0 && \
    npm list @modelcontextprotocol/sdk

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Verify the build success
RUN if [ ! -f "./build/index.js" ]; then \
      echo "❌ Build verification failed: index.js not found"; \
      exit 1; \
    else \
      echo "✅ Build verification successful"; \
    fi

# Production image
FROM node:20-alpine

WORKDIR /app

# Set NODE_ENV and other environment variables
ENV NODE_ENV=production \
    STORAGE_TYPE=file \
    PROMPTS_DIR=/app/data/prompts \
    BACKUPS_DIR=/app/data/backups \
    HTTP_SERVER=false \
    PORT=3003 \
    HOST=0.0.0.0

# Copy only necessary files from the build stage
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/README.md ./README.md
COPY --from=build /app/config ./config

# Explicitly copy package.json to build directory to fix path issues
RUN cp ./package.json ./build/package.json

# Create a non-root user with a home directory
RUN adduser -D -h /home/mcprompts mcprompts

# Create data directory with correct permissions
RUN mkdir -p /app/data/prompts /app/data/backups && \
    chown -R mcprompts:mcprompts /app/data

# Set the user
USER mcprompts

# Create volume for data persistence
VOLUME ["/app/data"]

# Add image metadata
LABEL org.opencontainers.image.authors="modelcontextprotocol"
LABEL org.opencontainers.image.title="mcp-prompts"
LABEL org.opencontainers.image.description="MCP server for managing prompts and templates"
LABEL org.opencontainers.image.documentation="https://github.com/sparesparrow/mcp-prompts"
LABEL org.opencontainers.image.vendor="Model Context Protocol"
LABEL org.opencontainers.image.licenses="MIT"

# Expose the port
EXPOSE 3000 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:3003/health || exit 1

# Run the application
CMD ["node", "build/index.js"] 