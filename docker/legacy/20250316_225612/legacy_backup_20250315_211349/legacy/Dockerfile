FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install dependencies 
RUN npm install

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Set NODE_ENV and other environment variables
ENV NODE_ENV=production \
    STORAGE_TYPE=file \
    PROMPTS_DIR=/app/data/prompts \
    BACKUPS_DIR=/app/data/backups \
    HTTP_SERVER=true \
    PORT=3003 \
    HOST=0.0.0.0

# Copy only necessary files from the build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/README.md ./README.md

# Create a non-root user with a home directory
RUN adduser -D -h /home/mcp mcp

# Create data directory with correct permissions
RUN mkdir -p /app/data/prompts /app/data/backups && \
    chown -R mcp:mcp /app/data

# Set the user
USER mcp

# Create volume for data persistence
VOLUME ["/app/data"]

# Add image metadata
LABEL org.opencontainers.image.authors="sparesparrow"
LABEL org.opencontainers.image.title="mcp-prompts"
LABEL org.opencontainers.image.description="MCP server for managing prompts and templates"
LABEL org.opencontainers.image.documentation="https://github.com/sparesparrow/mcp-prompts"
LABEL org.opencontainers.image.vendor="sparesparrow"
LABEL org.opencontainers.image.licenses="MIT"

# Expose the port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:3003/health || exit 1

# Run the application
CMD ["node", "dist/index.js"]