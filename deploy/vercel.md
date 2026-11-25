# Vercel deployment

The Vercel project runs the repository's existing HTTP container; it does not build a separate
web application or use the npm package as its runtime.

## Request path

```mermaid
flowchart LR
    Client[MCP client / HTTP client] --> Vercel[Vercel routing]
    Vercel --> Service[mcp-prompts container service]
    Service --> HTTP[Node HTTP server :3003]
    HTTP --> MCP[/mcp Streamable HTTP]
    HTTP --> API[/v1 REST API]
    HTTP --> Probe[/health · /ready · /version]
    MCP --> Library[(Bundled data/prompts)]
    API --> Library
```

- `vercel.json` sends every path to the `mcp-prompts` container service.
- The service uses the root `Dockerfile`, which starts `dist/index.js` on port `3003`.
- The image runs as an unprivileged user and defaults to read-only mode.
- Prompt data is bundled with the image. The Vercel instance is intentionally stateless:
  changes are not persisted, and the deployed service must not be switched to read-write mode
  without adding durable storage and authentication.
- Profile selection is per client, for example
  `https://mcp-prompts.vercel.app/mcp?profile=software-dev`.

## Runtime contract

| Endpoint | Expected result |
|---|---|
| `GET /health` | HTTP 200; process liveness |
| `GET /ready` | HTTP 200; `status=ready`, `readOnly=true`, `auth=none`, `storage=memory` |
| `GET /version` | Version matches `package.json` on the deployed commit |
| `POST /mcp?profile=<name>` | Streamable HTTP MCP endpoint; profile-specific prompt catalogue |

The public deployment is deliberately read-only. The absence of a bearer token is acceptable only
because no write operations are exposed; do not enable writes on this public service without
configuring a strong token, durable state storage and a reviewed access policy.

## Continuous verification

`.github/workflows/vercel-smoke.yml` checks the production URL after pushes to `main`, every
six hours, and on manual dispatch. It waits for readiness, checks the runtime mode and version,
then connects as an actual MCP client to all seven profiles and verifies the read-only tool set,
prompt listing and template application.

This is an operational smoke test, not a release gate: Vercel's Git integration may assign the
production domain before the GitHub workflow finishes. Configure the workflow as a required Vercel
Deployment Check in the Vercel project if production promotion must wait for it.
