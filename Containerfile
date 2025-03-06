FROM node:20-slim

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Expose port if needed (for health checks or APIs)
EXPOSE 3000

# Set the command to run the server
CMD ["node", "build/index.js"] 