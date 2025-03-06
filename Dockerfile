FROM node:20-slim

WORKDIR /app

# Install PostgreSQL client for health checks
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Copy package files first to leverage Docker cache
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Create necessary directories
RUN mkdir -p logs exports backups

# Make scripts executable
RUN chmod +x scripts/*.ts bin/*.ts bin/*.js docker/startup.sh

# Expose port for the server
EXPOSE 3000

# Set the command to run the server
CMD ["docker/startup.sh"] 