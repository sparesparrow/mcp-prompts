FROM node:20-alpine AS build

WORKDIR /app

# Set env to indicate Docker build
ENV DOCKER_BUILD=true

# Copy source files first
COPY . .

# Install dependencies without running the prepare script (which runs build)
RUN npm ci --no-prepare

# Build the application
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Set NODE_ENV and other environment variables
ENV NODE_ENV=production
ENV STORAGE_TYPE=file
ENV PROMPTS_DIR=/app/data/prompts
ENV BACKUPS_DIR=/app/data/backups

# Copy only necessary files from the build stage
COPY --from=build /app/build ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

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
LABEL org.opencontainers.image.documentation="https://github.com/modelcontextprotocol/mcp-prompts"
LABEL org.opencontainers.image.vendor="Model Context Protocol"
LABEL org.opencontainers.image.licenses="MIT"

# Expose the port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:3003/health || exit 1

# Run the application
CMD ["node", "index.js"]