# Archived compose files for the stdio images

`docker-compose.mcp.yml` and `docker-compose.file.yml` ran the stdio server as a compose
service, with a published port and an HTTP health check. The stdio server opens no port, and
without a client on its standard input it exits at once, so these services were never healthy.

- To run the stdio server in a container, let the MCP client start it:
  `docker run -i --rm ghcr.io/sparesparrow/mcp-prompts:mcp` (see `deploy/README.md`).
- For a server that stays up, use the HTTP image: `docker compose up -d --wait --build` with the
  `docker-compose.yml` at the repository root.
