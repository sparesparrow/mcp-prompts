import { describe, it, expect } from 'vitest';
import { createServer, startHttpServer } from './http-server';

/**
 * Tests for src/http-server.ts
 *
 * Backlog H4 target #1: covers the public surface of the HTTP server stub —
 * route registration, handler shape, and the listen() lifecycle.
 *
 * The current http-server.ts is a stub (no Express). These tests pin the
 * contract so that a future Express migration must preserve the same routes,
 * status payloads, and listen() callback semantics.
 */

describe('http-server', () => {
  describe('createServer', () => {
    it('resolves to an app with a listen function', async () => {
      const app = await createServer();
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });

    it('registers exactly the documented routes: /health, /ready, /version', async () => {
      const app = await createServer();
      const paths = (app._router?.stack ?? []).map((layer: any) => layer.route?.path).sort();
      expect(paths).toEqual(['/health', '/ready', '/version']);
    });

    it('/health handler returns status=ok, service=mcp-prompts, and an ISO timestamp', async () => {
      const app = await createServer();
      const route = app._router.stack.find((l: any) => l.route?.path === '/health').route;
      let payload: any = null;
      const res = { json: (data: any) => { payload = data; return res; } };
      route.handler({} as any, res as any);
      expect(payload.status).toBe('ok');
      expect(payload.service).toBe('mcp-prompts');
      // ISO timestamp -> parseable back to a Date
      expect(new Date(payload.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('/ready handler returns status=ready, service=mcp-prompts', async () => {
      const app = await createServer();
      const route = app._router.stack.find((l: any) => l.route?.path === '/ready').route;
      let payload: any = null;
      const res = { json: (data: any) => { payload = data; return res; } };
      route.handler({} as any, res as any);
      expect(payload).toEqual({ status: 'ready', service: 'mcp-prompts' });
    });

    it('/version handler returns the package version and service name', async () => {
      const app = await createServer();
      const route = app._router.stack.find((l: any) => l.route?.path === '/version').route;
      let payload: any = null;
      const res = { json: (data: any) => { payload = data; return res; } };
      route.handler({} as any, res as any);
      expect(payload.service).toBe('mcp-prompts');
      expect(typeof payload.version).toBe('string');
      expect(payload.version.length).toBeGreaterThan(0);
    });
  });

  describe('listen()', () => {
    it('invokes the (port, host, callback) form', async () => {
      const app = await createServer();
      let called = false;
      app.listen(0, '127.0.0.1', () => { called = true; });
      expect(called).toBe(true);
    });

    it('invokes the (port, callback) form where the second arg is the cb', async () => {
      const app = await createServer();
      let called = false;
      app.listen(0, () => { called = true; });
      expect(called).toBe(true);
    });

    it('returns the app for chaining', async () => {
      const app = await createServer();
      const ret = app.listen(0, '127.0.0.1', () => {});
      expect(ret).toBe(app);
    });
  });

  describe('startHttpServer', () => {
    it('is callable and resolves without throwing on a high port', async () => {
      // Default host 0.0.0.0; the stub's listen() does not actually bind, so a
      // random high port is safe.
      await expect(startHttpServer(57000, '127.0.0.1')).resolves.toBeUndefined();
    });
  });
});
