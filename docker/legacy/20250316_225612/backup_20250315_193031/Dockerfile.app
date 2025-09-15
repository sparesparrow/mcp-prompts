# Build stage
FROM node:20-alpine as build

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Copy source files
COPY src/ ./src/
COPY tsconfig.json ./

# Install dependencies
RUN npm install --ignore-scripts

# Run build
RUN npm run build

# App stage - extend from base
FROM sparesparrow/mcp-prompts-base:latest

# Copy from build stage
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

# Set non-root user
USER node

# Default command
CMD ["node", "dist/index.js"] 