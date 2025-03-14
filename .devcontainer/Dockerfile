FROM node:20-alpine

# Install git and other dependencies
RUN apk add --no-cache git bash curl postgresql-client

# Set working directory
WORKDIR /workspace

# Install global npm packages
RUN npm install -g typescript @modelcontextprotocol/inspector nodemon

# Set environment variables
ENV NODE_ENV=development
ENV STORAGE_TYPE=file
ENV PROMPTS_DIR=/workspace/data/prompts
ENV BACKUPS_DIR=/workspace/data/backups

# Create required directories
RUN mkdir -p /workspace/data/prompts /workspace/data/backups

# Use non-root user for better security (matches the user in devcontainer.json)
USER node
