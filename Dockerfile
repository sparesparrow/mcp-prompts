FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies and build
RUN corepack enable && pnpm install
COPY . .
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp-prompts -u 1001

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN corepack enable && pnpm install --prod && pnpm store prune

# Copy built application and data from builder stage
COPY --from=builder --chown=mcp-prompts:nodejs /app/dist ./dist
COPY --from=builder --chown=mcp-prompts:nodejs /app/data ./data

# Switch to non-root user
USER mcp-prompts

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3003
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "require('http').request({hostname: 'localhost', port: process.env.PORT || 3003, path: '/health', timeout: 2000}, (res) => process.exit(res.statusCode !== 200)).end()"

# Start the application
CMD ["node", "./dist/index.js"]

