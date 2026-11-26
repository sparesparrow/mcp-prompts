import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { loadConfig } from './config';
import { startHttpServer, type HttpServerApp } from './http-server';
import { PromptStore } from './prompt-store';
import { DEFAULT_OPTIONS, mergeOptions } from './server-options';

// The remote setup docs/10 describes (issue #141): mcp-prompts-http on a Tailscale node, read-only,
// with the token in a file and the Host header limited to the node's tailnet names. The server
// listens on loopback here; the Host header stands in for the MagicDNS name.

const NODE = 'phone.tail0000.ts.net';
const TAILNET_IP = '100.64.0.7';

interface Reply {
  status: number;
  body: string;
}

function post(app: HttpServerApp, body: unknown, headers: Record<string, string>): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: app.address()!.port,
      method: 'POST',
      path: '/mcp',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

describe('mcp-prompts-http on a tailnet', () => {
  let dir: string;
  let token: string;
  let app: HttpServerApp;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-prompts-tailnet-'));
    token = 'a'.repeat(32) + 'b'.repeat(32);
    fs.writeFileSync(path.join(dir, 'token'), `${token}\n`, { mode: 0o600 });
    const config = loadConfig({
      HOST: TAILNET_IP,
      MCP_PROMPTS_AUTH_TOKEN_FILE: path.join(dir, 'token'),
      MCP_PROMPTS_ALLOWED_HOSTS: `${NODE},${TAILNET_IP}`,
    });
    expect(config).toMatchObject({ host: TAILNET_IP, authToken: token, allowedHosts: [NODE, TAILNET_IP] });

    const store = new PromptStore();
    store.add({ id: 'hello', name: 'Hello', content: 'Hello {{who}}', isTemplate: true, tags: [] });
    app = await startHttpServer(0, '127.0.0.1', {
      store,
      serverOptions: mergeOptions(DEFAULT_OPTIONS, { readOnly: true }),
      authToken: config.authToken,
      allowedHosts: config.allowedHosts,
    });
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const listTools = { jsonrpc: '2.0', id: 1, method: 'tools/list' };

  it('serves the read-only tools to a client with the token, by name or by address', async () => {
    for (const host of [`${NODE}:3003`, `${TAILNET_IP}:3003`]) {
      const reply = await post(app, listTools, { Host: host, Authorization: `Bearer ${token}` });
      expect(reply.status, host).toBe(200);
      const names = (JSON.parse(reply.body).result.tools as { name: string }[]).map(tool => tool.name);
      expect(names).toEqual(expect.arrayContaining(['list_prompts', 'get_prompt', 'apply_template']));
      expect(names.some(name => ['add_prompt', 'update_prompt', 'delete_prompt'].includes(name))).toBe(false);
    }
  });

  it('refuses a request without the token, or with a wrong one', async () => {
    expect((await post(app, listTools, { Host: NODE })).status).toBe(401);
    expect((await post(app, listTools, { Host: NODE, Authorization: 'Bearer not-the-token-0123456789' })).status).toBe(401);
    expect((await post(app, listTools, { Host: NODE, Authorization: token })).status).toBe(401);
  });

  it('refuses a request under any other name, even with the token', async () => {
    for (const host of ['evil.example', 'localhost', 'other-node.tail0000.ts.net']) {
      expect((await post(app, listTools, { Host: host, Authorization: `Bearer ${token}` })).status, host).toBe(403);
    }
  });

  it('answers a request with no initialize first (stateless), as the 2026-07-28 core expects', async () => {
    const reply = await post(app, {
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'apply_template', arguments: { id: 'hello', variables: { who: 'desktop' } } },
    }, { Host: NODE, Authorization: `Bearer ${token}`, 'MCP-Protocol-Version': '2025-11-25' });
    expect(reply.status).toBe(200);
    expect(reply.body).toContain('Hello desktop');
  });

  // SDK 1.32 (and the 2.x packages, as of 2.4.0) negotiate at most 2025-11-25. A client that sends
  // only the 2026-07-28 version is told which versions are supported. When the SDK learns the new
  // revision, this test fails and docs/10 should say the server speaks it.
  it('tells a 2026-07-28-only client which protocol versions it supports', async () => {
    const reply = await post(app, listTools, { Host: NODE, Authorization: `Bearer ${token}`, 'MCP-Protocol-Version': '2026-07-28' });
    expect(reply.status).toBe(400);
    expect(reply.body).toMatch(/Unsupported protocol version: 2026-07-28 \(supported versions: 2025-11-25/);
  });
});
