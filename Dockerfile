FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create prompts directory
RUN mkdir -p /app/prompts

# Set environment variables
ENV NODE_ENV=production
ENV STORAGE_TYPE=file
ENV PROMPTS_DIR=/app/prompts
ENV LOG_LEVEL=info

# Expose stdin and make terminal interactive
ENTRYPOINT ["node", "build/index.js"] 