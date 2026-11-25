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
| `GET /version` | Package version matches `package.json` on the deployed release |
| `POST /mcp?profile=<name>` | Streamable HTTP MCP endpoint; profile-specific prompt catalogue |

The public deployment is deliberately read-only. The absence of a bearer token is acceptable only
because no write operations are exposed; do not enable writes on this public service without
configuring a strong token, durable state storage and a reviewed access policy.

## Continuous verification

`.github/workflows/vercel-smoke.yml` checks the production URL after pushes to `main`, every
six hours, and on manual dispatch. It waits for readiness, checks the runtime mode and package
version, then connects as an actual MCP client to all seven profiles and verifies the read-only
tool set, prompt listing and template application.

The production push run creates the GitHub Actions check named **Verify production MCP endpoint**.
The workflow uses event-specific concurrency groups and does not cancel a push check when a
scheduled or manual monitoring run starts.

### Make the smoke test a production deployment gate

This final switch is a Vercel project setting; it is not represented in the repository's
`vercel.json` and the project-settings API currently available to this workflow does not expose
Deployment Checks configuration.

1. Open the Vercel project **mcp-prompts**.
2. Go to **Settings → Build and Deployment → Deployment Checks**.
3. Enable the **GitHub** check source (the Vercel for GitHub integration must be connected).
4. Require the GitHub Actions check **Verify production MCP endpoint** for the **Production**
   environment.
5. Keep automatic production-domain assignment enabled. Vercel should assign the production
   domain only after required checks pass.
6. Do not use **Force Promote** to bypass a failed smoke test.

The repository already defines `lint` and `type-check` scripts. Vercel's native checks can also
run these package scripts where available; enable them if desired, alongside the end-to-end check.

**Important limitation:** the workflow compares the deployed package version with
`package.json`; package versions do not change on every commit. The GitHub check itself is
associated with the commit that triggered the workflow, but the version endpoint is not a
cryptographic commit-identity check. A stronger deployment-identity assertion would require
exposing the Vercel deployment commit SHA through a trusted runtime value or validating the
deployment metadata through the Vercel API.

## Monitoring scope

The scheduled smoke test provides periodic functional monitoring, not instant alerting. It does
not currently send notifications to an external incident channel. Configure GitHub Actions
failure notifications or a dedicated alert integration if immediate operational alerts are
required.
