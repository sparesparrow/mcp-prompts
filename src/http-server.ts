import * as http from 'http';
import type { AddressInfo } from 'net';
import { z, ZodError } from 'zod';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from './utils.js';
import {
  CreatePromptParams,
  PromptNotFoundError,
  PromptStore,
  PromptUsageError,
  UpdatePromptParams,
} from './prompt-store.js';
import { createMcpServer, packageVersion } from './mcp-prompts-server.js';
import { DEFAULT_OPTIONS, OptionsError, optionsFromQuery, type ServerOptions } from './server-options.js';

// HTTP mode: the same prompts and operations as the MCP stdio server, as a small JSON API, plus a
// stateless MCP Streamable HTTP endpoint at /mcp whose query string picks a selection.
// Built on node:http so the server needs no web framework.

const MAX_BODY_BYTES = 1024 * 1024;

export interface RouteRequest {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  /** The underlying request and response, for handlers that write the response themselves. */
  raw?: { req: http.IncomingMessage; res: http.ServerResponse };
}

export interface RouteResponse {
  status: (code: number) => RouteResponse;
  json: (data: unknown) => RouteResponse;
  end: () => RouteResponse;
}

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (req: RouteRequest, res: RouteResponse) => void | Promise<void>;
}

export interface HttpServerApp {
  listen: (port: number | string, host?: string | (() => void), callback?: () => void) => HttpServerApp;
  close: () => Promise<void>;
  address: () => AddressInfo | null;
  routes: Route[];
  _router: { stack: Array<{ route: Route }> };
}

export interface HttpServerOptions {
  /** Prompts to serve; loaded from serverOptions (or PROMPTS_DIR) when left out. */
  store?: PromptStore;
  corsOrigin?: string;
  /** What this server serves: the selection, MCP capabilities and read-only switch. */
  serverOptions?: ServerOptions;
}

class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

const ApplyTemplateBody = z.object({ variables: z.record(z.string(), z.any()).default({}) });
const ToolCallBody = z.object({ arguments: z.record(z.string(), z.any()).default({}) });

const WRITE_TOOLS = ['add_prompt', 'update_prompt', 'delete_prompt'];

function buildRoutes(store: PromptStore, serverOptions: ServerOptions): Route[] {
  const version = packageVersion();
  const { readOnly } = serverOptions;

  // The MCP tools, callable over HTTP with the same names and arguments.
  const allTools: Record<string, { description: string; run: (args: Record<string, unknown>) => unknown }> = {
    list_prompts: {
      description: 'List prompts, optionally filtered by tags (any match) or a search term.',
      run: args => store.list(z.object({ tags: z.array(z.string()).optional(), search: z.string().optional() }).parse(args)),
    },
    get_prompt: {
      description: 'Get a prompt by its ID.',
      run: args => store.get(z.object({ id: z.string() }).parse(args).id),
    },
    add_prompt: {
      description: 'Add a new prompt.',
      run: args => store.add(CreatePromptParams.parse(args)),
    },
    update_prompt: {
      description: 'Update fields of an existing prompt; its version is incremented.',
      run: args => {
        const { id, updates } = z.object({ id: z.string(), updates: UpdatePromptParams }).parse(args);
        return store.update(id, updates);
      },
    },
    delete_prompt: {
      description: 'Delete a prompt by its ID.',
      run: args => store.delete(z.object({ id: z.string() }).parse(args).id),
    },
    apply_template: {
      description: "Fill a template prompt's {{variables}} and return the resulting text.",
      run: args => {
        const { id, variables } = z.object({ id: z.string(), variables: z.record(z.string(), z.any()) }).parse(args);
        return store.applyTemplate(id, variables);
      },
    },
    get_stats: {
      description: 'Counts of prompts and templates, with the tags and categories in use.',
      run: () => store.stats(),
    },
  };
  const tools = Object.fromEntries(
    Object.entries(allTools).filter(([name]) => !(readOnly && WRITE_TOOLS.includes(name)))
  );

  const routes: Array<Route & { write?: boolean }> = [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => {
        res.json({ status: 'ok', service: 'mcp-prompts', timestamp: new Date().toISOString() });
      },
    },
    {
      method: 'GET',
      path: '/ready',
      handler: (_req, res) => {
        res.json({ status: 'ready', service: 'mcp-prompts' });
      },
    },
    {
      method: 'GET',
      path: '/version',
      handler: (_req, res) => {
        res.json({ version, service: 'mcp-prompts' });
      },
    },
    {
      method: 'GET',
      path: '/v1/prompts',
      handler: (req, res) => {
        const tags = req.query.get('tags')?.split(',').map(t => t.trim()).filter(Boolean);
        const search = req.query.get('search') ?? undefined;
        res.json({ prompts: store.list({ tags, search }) });
      },
    },
    {
      method: 'POST',
      path: '/v1/prompts',
      write: true,
      handler: (req, res) => {
        res.status(201).json(store.add(CreatePromptParams.parse(req.body)));
      },
    },
    {
      method: 'GET',
      path: '/v1/prompts/:id',
      handler: (req, res) => {
        res.json(store.get(req.params.id));
      },
    },
    {
      method: 'PUT',
      path: '/v1/prompts/:id',
      write: true,
      handler: (req, res) => {
        res.json(store.update(req.params.id, UpdatePromptParams.parse(req.body)));
      },
    },
    {
      method: 'DELETE',
      path: '/v1/prompts/:id',
      write: true,
      handler: (req, res) => {
        store.delete(req.params.id);
        res.status(204).end();
      },
    },
    {
      method: 'POST',
      path: '/v1/prompts/:id/apply',
      handler: (req, res) => {
        const { variables } = ApplyTemplateBody.parse(req.body ?? {});
        res.json({ id: req.params.id, result: store.applyTemplate(req.params.id, variables) });
      },
    },
    {
      method: 'GET',
      path: '/v1/stats',
      handler: (_req, res) => {
        res.json(store.stats());
      },
    },
    {
      method: 'GET',
      path: '/mcp/tools',
      handler: (_req, res) => {
        res.json({ tools: Object.entries(tools).map(([name, t]) => ({ name, description: t.description })) });
      },
    },
    {
      method: 'POST',
      path: '/mcp/tools/:name',
      handler: (req, res) => {
        const tool = tools[req.params.name];
        if (!tool) throw new HttpError(404, `Unknown tool: ${req.params.name}`);
        const { arguments: args } = ToolCallBody.parse(req.body ?? {});
        res.json({ result: tool.run(args) });
      },
    },
    {
      // MCP Streamable HTTP, stateless: every POST gets its own server over the shared store, so
      // the query string can choose a selection per client. It narrows what this server serves.
      method: 'POST',
      path: '/mcp',
      handler: async req => {
        if (!req.raw) throw new HttpError(500, 'The MCP endpoint needs the raw request');
        let fromUrl;
        try {
          fromUrl = optionsFromQuery(req.query);
        } catch (error) {
          if (error instanceof OptionsError) throw new HttpError(400, error.message);
          throw error;
        }
        const view = store.select({
          prompts: fromUrl.prompts ?? 'all',
          templates: fromUrl.templates ?? 'all',
          exclude: fromUrl.exclude ?? [],
        });
        const server = await createMcpServer({
          store: view,
          expose: fromUrl.expose ?? serverOptions.expose,
          // A URL can make the session read-only, never the reverse.
          readOnly: readOnly || fromUrl.readOnly === true,
        });
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        req.raw.res.on('close', () => {
          transport.close().catch(() => undefined);
          server.close().catch(() => undefined);
        });
        await server.connect(transport);
        await transport.handleRequest(req.raw.req, req.raw.res, req.body);
      },
    },
  ];
  return routes.filter(route => !(readOnly && route.write)).map(({ write: _write, ...route }) => route);
}

/** Matches '/v1/prompts/:id' style patterns; returns the decoded params or null. */
function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Request body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export async function createServer(options: HttpServerOptions = {}): Promise<HttpServerApp> {
  const serverOptions = options.serverOptions ?? DEFAULT_OPTIONS;
  let base = options.store;
  if (!base) {
    base = new PromptStore();
    if (options.serverOptions) {
      base.load({ promptsDir: serverOptions.promptsDir, dirs: serverOptions.dirs });
    } else {
      base.loadDefault();
    }
  }
  for (const warning of base.selectionWarnings(serverOptions.selection)) logger.warn(warning);
  const routes = buildRoutes(base.select(serverOptions.selection), serverOptions);

  const server = http.createServer(async (req, res) => {
    if (options.corsOrigin) res.setHeader('Access-Control-Allow-Origin', options.corsOrigin);
    const send = (code: number, data?: unknown) => {
      if (res.headersSent) return;
      if (data === undefined) {
        res.writeHead(code).end();
      } else {
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(data));
      }
    };

    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const candidates = routes
        .map(route => ({ route, params: matchPath(route.path, url.pathname) }))
        .filter((c): c is { route: Route; params: Record<string, string> } => c.params !== null);

      if (candidates.length === 0) return send(404, { error: `Not found: ${url.pathname}` });

      if (req.method === 'OPTIONS' && options.corsOrigin) {
        res.setHeader('Access-Control-Allow-Methods', candidates.map(c => c.route.method).join(', '));
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Protocol-Version, Mcp-Session-Id');
        return send(204);
      }

      const match = candidates.find(c => c.route.method === req.method);
      if (!match) {
        res.setHeader('Allow', candidates.map(c => c.route.method).join(', '));
        return send(405, { error: `Method ${req.method} not allowed on ${url.pathname}` });
      }

      const body = req.method === 'POST' || req.method === 'PUT' ? await readJsonBody(req) : undefined;
      let statusCode = 200;
      const routeRes: RouteResponse = {
        status: code => { statusCode = code; return routeRes; },
        json: data => { send(statusCode, data); return routeRes; },
        end: () => { send(statusCode); return routeRes; },
      };
      await match.route.handler({ params: match.params, query: url.searchParams, body, raw: { req, res } }, routeRes);
    } catch (error) {
      if (error instanceof HttpError) return send(error.statusCode, { error: error.message });
      if (error instanceof ZodError) return send(400, { error: 'Invalid request', details: error.issues });
      if (error instanceof PromptNotFoundError) return send(404, { error: error.message });
      if (error instanceof PromptUsageError) return send(400, { error: error.message });
      logger.error('Unhandled error in HTTP handler:', error);
      return send(500, { error: 'Internal server error' });
    }
  });

  const app: HttpServerApp = {
    listen: (port, host, callback) => {
      const cb = typeof host === 'function' ? host : callback;
      const hostname = typeof host === 'string' ? host : undefined;
      server.listen(Number(port), hostname, () => cb?.());
      return app;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        if (!server.listening) return resolve();
        server.close(err => (err ? reject(err) : resolve()));
      }),
    address: () => {
      const addr = server.address();
      return addr && typeof addr === 'object' ? addr : null;
    },
    routes,
    _router: { stack: routes.map(route => ({ route })) },
  };

  return app;
}

/** Starts the HTTP server and resolves once it is accepting connections. */
export async function startHttpServer(
  port: number = 3003,
  host: string = '0.0.0.0',
  options: HttpServerOptions = {}
): Promise<HttpServerApp> {
  const app = await createServer(options);
  await new Promise<void>(resolve => app.listen(port, host, resolve));
  const addr = app.address();
  logger.info(`MCP Prompts HTTP server listening on ${host}:${addr?.port ?? port}`);
  return app;
}

export default createServer;
