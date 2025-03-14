FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies but skip prepare scripts
ENV npm_config_ignore_scripts=true
RUN npm install
ENV npm_config_ignore_scripts=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create data directory
RUN mkdir -p /data

# Ensure the index.js file is executable
RUN chmod +x /app/build/index.js

# Create non-root user
RUN addgroup -S mcp && adduser -S mcp -G mcp && \
    chown -R mcp:mcp /app /data

# Switch to non-root user
USER mcp

# Environment variables
ENV NODE_ENV=production \
    STORAGE_TYPE=file \
    PROMPTS_DIR=/data/prompts \
    LOG_LEVEL=info

# Volume for shared data
VOLUME /data

# Entry point
CMD ["node", "/app/build/index.js"]