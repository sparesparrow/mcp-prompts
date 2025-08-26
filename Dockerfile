FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm fetch

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/ /app/
COPY . .
RUN corepack enable && pnpm install --no-frozen-lockfile --ignore-scripts

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/ /app/
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD wget --no-verbose --spider http://localhost:3003/health || exit 1
CMD ["node", "--import=tsx", "./src/index.ts"]

