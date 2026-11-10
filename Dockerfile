# HTTP image (tag: latest): the JSON API and MCP Streamable HTTP at /mcp, on port 3003.
# Read-only unless told otherwise, so `docker run -p 127.0.0.1:3003:3003 <image>` is safe to try.
# deploy/http-catalog and deploy/http-workspace run this image; deploy/README.md compares them.
#
# Both the build and the dependency install run on the build machine's own platform: the output
# is plain JavaScript and no production dependency has native code, so node_modules is the same
# for every target. Nothing but file copies runs under emulation (pnpm under QEMU hung on arm64),
# and the runtime image carries no package manager.
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build && pnpm prune --prod

FROM node:22-alpine AS production
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S mcp-prompts -u 1001 -G nodejs

COPY --from=builder --chown=mcp-prompts:nodejs /app/package.json ./package.json
COPY --from=builder --chown=mcp-prompts:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcp-prompts:nodejs /app/dist ./dist
COPY --from=builder --chown=mcp-prompts:nodejs /app/data/prompts ./data/prompts
COPY --from=builder --chown=mcp-prompts:nodejs /app/data/sample-prompts.json ./data/sample-prompts.json

# Where a read-write deployment saves changes (MCP_PROMPTS_STATE_DIR=/data); unused otherwise.
RUN mkdir -p /data && chown mcp-prompts:nodejs /data

USER mcp-prompts

ENV NODE_ENV=production
ENV PORT=3003
# The container's own interface. Publish the port on 127.0.0.1 of the host unless the server is
# meant to be reachable from other machines.
ENV HOST=0.0.0.0
# Without a token the server refuses to accept writes from beyond loopback. To allow them:
# MCP_PROMPTS_READ_ONLY=false with MCP_PROMPTS_AUTH_TOKEN (or _FILE) and MCP_PROMPTS_STATE_DIR=/data.
ENV MCP_PROMPTS_READ_ONLY=true

EXPOSE 3003

# 127.0.0.1, not localhost: the server listens on IPv4 and localhost may resolve to ::1 first.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3003) + '/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Arguments after the image name go to the server: `docker run <image> --templates mia-car`.
ENTRYPOINT ["node", "dist/index.js"]
