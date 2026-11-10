import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { z, ZodError } from 'zod';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from './utils.js';
import {
  CreatePromptParams,
  PromptConflictError,
  PromptNotFoundError,
  PromptStorageError,
  PromptStore,
  PromptUsageError,
  UpdatePromptParams,
} from './prompt-store.js';
import { createMcpServer, packageVersion } from './mcp-prompts-server.js';
import { DEFAULT_OPTIONS, OptionsError, openStore, optionsFromQuery, selectFor, type OptionLayer, type ServerOptions } from './server-options.js';
import { buildAccessPolicy, checkSource, checkToken, startupRefusal, type AccessPolicy } from './http-security.js';

// HTTP mode: the same prompts and operations as the MCP stdio server, as a small JSON API, plus a
// stateless MCP Streamable HTTP endpoint at /mcp whose query string picks a selection.
// Built on node:http so the server needs no web framework.

const MAX_BODY_BYTES = 1024 * 1024;
// How much of an oversized body is read and thrown away so the 413 reaches the client; a sender
// that goes past this is cut off instead.
const MAX_DISCARD_BYTES = 8 * MAX_BODY_BYTES;

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
  /** A health probe: answered whatever the Host, Origin or token. */
  public?: boolean;
}

export interface HttpServerApp {
  listen: (port: number | string, host?: string | (() => void), callback?: () => void) => HttpServerApp;
  close: () => Promise<void>;
  address: () => AddressInfo | null;
  /** Calls listener once if listening fails (port in use, no permission). */
  onListenError: (listener: (error: Error) => void) => void;
  routes: Route[];
  _router: { stack: Array<{ route: Route }> };
}

export interface HttpServerOptions {
  /** Prompts to serve; loaded from serverOptions (or PROMPTS_DIR) when left out. */
  store?: PromptStore;
  corsOrigin?: string;
  /** What this server serves: the selection, MCP capabilities and read-only switch. */
  serverOptions?: ServerOptions;
  /**
   * Who may call the server. Left out, only loopback Host names and origins are accepted and no
   * token is required, which suits a server bound to 127.0.0.1; startHttpServer derives it from
   * the host it listens on.
   */
  access?: AccessPolicy;
  /** Bearer token for the derived policy (ignored when access is given). */
  authToken?: string;
  allowedHosts?: string[];
  allowedOrigins?: string[];
  /** Listen beyond loopback with writes enabled and no token. */
  allowInsecure?: boolean;
}

class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

const ApplyTemplateBody = z.object({ variables: z.record(z.string(), z.any()).default({}) });
const ListFilterArgs = z.object({
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  isTemplate: z.boolean().optional(),
});
const ListQuery = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  isTemplate: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
const ToolCallBody = z.object({ arguments: z.record(z.string(), z.any()).default({}) });

const WRITE_TOOLS = ['add_prompt', 'update_prompt', 'delete_prompt'];

function buildRoutes(store: PromptStore, serverOptions: ServerOptions, access: AccessPolicy): Route[] {
  const version = packageVersion();
  const { readOnly } = serverOptions;

  // The MCP tools, callable over HTTP with the same names and arguments.
  const allTools: Record<string, { description: string; run: (args: Record<string, unknown>) => unknown }> = {
    list_prompts: {
      description: 'List prompts, optionally filtered by tags (any match) or a search term.',
      run: args => store.list(ListFilterArgs.parse(args)),
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
      public: true,
      handler: (_req, res) => {
        res.json({ status: 'ok', service: 'mcp-prompts', timestamp: new Date().toISOString() });
      },
    },
    {
      method: 'GET',
      path: '/ready',
      public: true,
      // Readiness, and the mode the server runs in, so that a health check can insist on it:
      // deploy/http-catalog is healthy only while read-only, deploy/http-workspace only while it
      // requires a token and saves to disk. An image too old to know those settings fails the check.
      handler: (_req, res) => {
        const stateDir = store.stateDir;
        if (stateDir) {
          try {
            fs.accessSync(stateDir, fs.constants.R_OK | fs.constants.W_OK);
          } catch {
            res.status(503).json({ status: 'unavailable', service: 'mcp-prompts', reason: 'the state directory cannot be written' });
            return;
          }
        }
        res.json({
          status: 'ready',
          service: 'mcp-prompts',
          readOnly,
          auth: access.token ? 'token' : 'none',
          storage: stateDir ? 'file' : 'memory',
        });
      },
    },
    {
      method: 'GET',
      path: '/version',
      public: true,
      handler: (_req, res) => {
        res.json({ version, service: 'mcp-prompts' });
      },
    },
    {
      method: 'GET',
      path: '/v1/prompts',
      handler: (req, res) => {
        const tags = req.query.get('tags')?.split(',').map(t => t.trim()).filter(Boolean);
        const { limit, offset, ...filter } = ListQuery.parse({
          search: req.query.get('search') ?? undefined,
          category: req.query.get('category') ?? undefined,
          isTemplate: req.query.get('isTemplate') ?? undefined,
          limit: req.query.get('limit') ?? undefined,
          offset: req.query.get('offset') ?? undefined,
        });
        // Every match unless the caller asks for a page; total and has_more say what was left out.
        res.json(store.page({ tags, ...filter }, { limit, offset }));
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
        const rendered = store.render(req.params.id, variables);
        // `result` is the text, as before; `missing` and `unused` say whether it is complete.
        res.json({ id: req.params.id, result: rendered.text, missing: rendered.missing, unused: rendered.unused });
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
        let fromUrl: OptionLayer;
        let view: PromptStore;
        try {
          fromUrl = optionsFromQuery(req.query);
          // A profile in the URL, like the lists, chooses from what this server serves.
          view = selectFor(store, {
            profiles: fromUrl.profiles,
            selection: { prompts: fromUrl.prompts ?? 'all', templates: fromUrl.templates ?? 'all', exclude: fromUrl.exclude ?? [] },
          });
        } catch (error) {
          if (error instanceof OptionsError) throw new HttpError(400, error.message);
          throw error;
        }
        const server = await createMcpServer({
          store: view,
          expose: fromUrl.expose ?? serverOptions.expose,
          // A URL can make the session read-only, never the reverse.
          readOnly: readOnly || fromUrl.readOnly === true,
          profiles: fromUrl.profiles ?? serverOptions.profiles,
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
      try {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } catch {
        // A stray % in the path is the caller's mistake, not a server error.
        throw new HttpError(400, `Malformed percent-encoding in the path: ${pathname}`);
      }
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Keep reading without keeping: closing the socket mid-upload would reset the connection
        // before the client could read the 413.
        tooLarge = true;
        chunks.length = 0;
        if (size > MAX_DISCARD_BYTES) req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(new HttpError(413, `Request body too large (limit ${MAX_BODY_BYTES} bytes)`));
      if (chunks.length === 0) return resolve(undefined);
      // Browsers send text/plain and form posts across sites without a CORS preflight; requiring
      // JSON keeps a web page from posting to this API behind the user's back.
      const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
      if (contentType !== 'application/json') {
        return reject(new HttpError(415, 'Send the body as Content-Type: application/json'));
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Request body is not valid JSON'));
      }
    });
    req.on('error', reject);
    req.on('close', () => {
      if (tooLarge) reject(new HttpError(413, `Request body too large (limit ${MAX_BODY_BYTES} bytes)`));
    });
  });
}

export async function createServer(options: HttpServerOptions = {}): Promise<HttpServerApp> {
  const serverOptions = options.serverOptions ?? DEFAULT_OPTIONS;
  let base = options.store;
  if (!base) {
    if (options.serverOptions) {
      // The library, the user's directories and what earlier runs saved to the state directory.
      base = openStore(serverOptions).base;
    } else {
      base = new PromptStore();
      base.loadDefault();
    }
  }
  for (const warning of base.selectionWarnings(serverOptions.selection)) logger.warn(warning);
  // Throws OptionsError for a profile the library does not define.
  const served = selectFor(base, serverOptions);
  const access = options.access ?? buildAccessPolicy('127.0.0.1', {
    token: options.authToken,
    allowedHosts: options.allowedHosts,
    allowedOrigins: options.allowedOrigins,
    corsOrigin: options.corsOrigin,
  });
  const routes = buildRoutes(served, serverOptions, access);

  const server = http.createServer(async (req, res) => {
    if (options.corsOrigin) res.setHeader('Access-Control-Allow-Origin', options.corsOrigin);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (code: number, data?: unknown) => {
      if (res.headersSent) return;
      if (data === undefined) {
        res.writeHead(code).end();
      } else {
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(data));
      }
    };

    // What an operator needs when a client reports "it does not connect": refusals at the default
    // log level, every request at LOG_LEVEL=debug. Neither the query string nor any header value
    // that could hold the token is written.
    const started = Date.now();
    res.on('finish', () => {
      const entry = { method: req.method, path: (req.url ?? '/').split('?')[0], status: res.statusCode, ms: Date.now() - started };
      if (res.statusCode === 401 || res.statusCode === 403) {
        logger.warn({ ...entry, from: req.socket.remoteAddress, host: req.headers.host, origin: req.headers.origin }, 'Refused request');
      } else {
        logger.debug(entry, 'Request');
      }
    });

    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const candidates = routes
        .map(route => ({ route, params: matchPath(route.path, url.pathname) }))
        .filter((c): c is { route: Route; params: Record<string, string> } => c.params !== null);

      // HEAD is GET without the body; node leaves the body out by itself.
      const method = req.method === 'HEAD' ? 'GET' : req.method;
      const match = candidates.find(c => c.route.method === method);
      const isProbe = match?.route.public === true;

      // Host and Origin are checked before anything is revealed, the CORS preflight included.
      if (!isProbe) {
        const refused = checkSource(access, req);
        if (refused) return send(refused.status, { error: refused.message });
      }

      if (candidates.length === 0) return send(404, { error: `Not found: ${url.pathname}` });

      if (req.method === 'OPTIONS' && options.corsOrigin) {
        res.setHeader('Access-Control-Allow-Methods', candidates.map(c => c.route.method).join(', '));
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id');
        return send(204);
      }

      if (!match) {
        res.setHeader('Allow', candidates.map(c => c.route.method).join(', '));
        return send(405, { error: `Method ${req.method} not allowed on ${url.pathname}` });
      }

      if (!isProbe) {
        const denied = checkToken(access, req);
        if (denied) {
          res.setHeader('WWW-Authenticate', 'Bearer realm="mcp-prompts"');
          return send(denied.status, { error: denied.message });
        }
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
      if (error instanceof HttpError) {
        // The rest of an oversized upload is not worth keeping the connection for.
        if (error.statusCode === 413) res.setHeader('Connection', 'close');
        return send(error.statusCode, { error: error.message });
      }
      if (error instanceof ZodError) return send(400, { error: 'Invalid request', details: error.issues });
      if (error instanceof PromptNotFoundError) return send(404, { error: error.message });
      if (error instanceof PromptConflictError) return send(409, { error: error.message });
      if (error instanceof PromptUsageError) return send(400, { error: error.message });
      if (error instanceof PromptStorageError) return send(500, { error: error.message });
      logger.error({ err: error }, 'Unhandled error in HTTP handler');
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
        // Idle keep-alive connections would otherwise hold the shutdown until they time out.
        server.closeIdleConnections();
      }),
    address: () => {
      const addr = server.address();
      return addr && typeof addr === 'object' ? addr : null;
    },
    onListenError: listener => { server.once('error', listener); },
    routes,
    _router: { stack: routes.map(route => ({ route })) },
  };

  return app;
}

/**
 * Starts the HTTP server and resolves once it is accepting connections. Rejects when the port
 * cannot be bound, and when the settings would expose unauthenticated writes beyond this machine.
 */
export async function startHttpServer(
  port: number = 3003,
  host: string = '127.0.0.1',
  options: HttpServerOptions = {}
): Promise<HttpServerApp> {
  const readOnly = (options.serverOptions ?? DEFAULT_OPTIONS).readOnly;
  const token = options.access ? options.access.token : options.authToken;
  const refusal = startupRefusal({ host, readOnly, token, allowInsecure: options.allowInsecure });
  if (refusal) throw new Error(refusal);

  const access = options.access ?? buildAccessPolicy(host, {
    token: options.authToken,
    allowedHosts: options.allowedHosts,
    allowedOrigins: options.allowedOrigins,
    corsOrigin: options.corsOrigin,
  });
  const app = await createServer({ ...options, access });
  await new Promise<void>((resolve, reject) => {
    app.onListenError(reject);
    app.listen(port, host, resolve);
  });
  const addr = app.address();
  logger.info(
    `MCP Prompts HTTP server listening on ${host}:${addr?.port ?? port} ` +
    `(${readOnly ? 'read-only' : 'read-write'}, ${access.token ? 'bearer token required' : 'no auth token'})`
  );
  return app;
}

export default createServer;
