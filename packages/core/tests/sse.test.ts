import { jest } from '@jest/globals';
jest.setTimeout(60000);
import type { Server } from 'node:http';

import { EventSource } from 'eventsource';
import express from 'express';

import { closeEventSource, closeServer } from '../../tests/setup.js';
import { getSseManager, resetSseManager, SseManager } from '../sse.js';
import * as sseModule from '../sse.js';

interface SseOptions {
  enableCompression?: boolean;
  compressionMinSize?: number;
  messageHistory?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

describe('SseManager', () => {
  let app: express.Application;
  let server: Server;
  let sseManager: SseManager;
  let port: number;
  let eventSources: EventSource[] = [];

  /**
   *
   * @param es
   */
  async function closeEventSource(es: EventSource): Promise<void> {
    return new Promise(resolve => {
      es.close();
      setTimeout(resolve, 100); // Wait a bit for closure
    });
  }

  beforeAll(async () => {
    resetSseManager();
    const options: SseOptions = {
      compressionMinSize: 1024,
      connectionTimeout: 60000,
      enableCompression: true,
      heartbeatInterval: 30000,
      maxRetries: 3,
      messageHistory: 100,
      retryDelay: 1000,
    };
    sseManager = getSseManager(options);
    app = express();
    app.get('/events', (req, res) => {
      console.log('[SSE TEST] /events route hit');
      sseManager.handleConnection(req, res);
    });
    await new Promise<void>(resolve => {
      server = app.listen(0, () => {
        port = (server.address() as any).port;
        console.log('[SSE TEST] Server started on port', port);
        resolve();
      });
    });
  });

  // Patch SseManager to add debug logging for client add/remove
  // Use bracket notation to avoid TypeScript errors if not present in type
  if (typeof (SseManager.prototype as any)['addClient'] === 'function') {
    const origAddClient = (SseManager.prototype as any)['addClient'];
    (SseManager.prototype as any)['addClient'] = function (...args: any[]) {
      const result = origAddClient.apply(this, args);
      console.log('[SSE TEST] SseManager.addClient called. Client IDs:', this.getClientIds());
      return result;
    };
  }
  if (typeof (SseManager.prototype as any)['removeClient'] === 'function') {
    const origRemoveClient = (SseManager.prototype as any)['removeClient'];
    (SseManager.prototype as any)['removeClient'] = function (...args: any[]) {
      const result = origRemoveClient.apply(this, args);
      console.log('[SSE TEST] SseManager.removeClient called. Client IDs:', this.getClientIds());
      return result;
    };
  }

  afterAll(async () => {
    console.log('[SSE TEST] afterAll: Closing all EventSources and server');

    // Zavřeme všechny EventSource spojení
    for (let i = 0; i < eventSources.length; i++) {
      console.log(`[SSE TEST] Closing EventSource #${i}`);
      await closeEventSource(eventSources[i]);
    }
    eventSources.length = 0;

    // Zavřeme server
    if (server) {
      await closeServer(server);
    }

    // Reset SSE manager - to zavře všechny intervaly
    resetSseManager();

    // Počkáme na dokončení všech operací
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterEach(async () => {
    console.log('[TEST] afterEach: cleaning up EventSources and clients');
    for (const clientId of sseManager.getClientIds()) {
      await sseManager.disconnectClient(clientId);
      console.log(`[SSE TEST] Disconnected client ${clientId} in afterEach`);
    }
    for (const es of eventSources) {
      es.close();
      console.log('[SSE TEST] EventSource closed in afterEach');
    }
    eventSources.length = 0;
    console.log('[TEST] afterEach: cleanup complete');
  });

  /**
   *
   * @param ms
   */
  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   *
   * @param port
   */
  function getSseUrl(port: number | string | undefined): string {
    if (!port || isNaN(Number(port))) {
      throw new Error(`[SSE TEST] Port is not defined nebo není číslo: ${port}`);
    }
    const url = `http://127.0.0.1:${port}/events`;
    console.log('[SSE TEST] EventSource URL', url);
    return url;
  }

  it('should establish SSE connection', async () => {
    console.log('[TEST] should establish SSE connection: started');
    const es = new EventSource(getSseUrl(port));
    eventSources.push(es);
    let resolved = false;
    await new Promise<void>((resolve, reject) => {
      const failTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log('[TEST] should establish SSE connection: timeout');
          console.log('[TEST] SseManager client IDs:', sseManager.getClientIds());
          es.close();
          reject(new Error('Timeout'));
        }
      }, 20000);
      failTimeout.unref?.();
      es.onopen = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(failTimeout);
          console.log('[TEST] should establish SSE connection: onopen');
          expect(es.readyState).toBe(1);
          es.close();
          resolve();
        }
      };
      es.onerror = err => {
        if (!resolved) {
          resolved = true;
          clearTimeout(failTimeout);
          console.log('[TEST] should establish SSE connection: onerror', err);
          es.close();
          reject(new Error('SSE error'));
        }
      };
    });
  });

  it('should send and receive messages', async () => {
    const es = new EventSource(getSseUrl(port));
    eventSources.push(es);
    let receivedConnected = false;
    let resolved = false;
    await new Promise<void>((resolve, reject) => {
      const failTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          es.close();
          reject(new Error('Timeout'));
        }
      }, 20000);
      failTimeout.unref?.();
      es.onmessage = (event: Event) => {
        if (resolved) return;
        const data = (event as any).data;
        console.log('[TEST] Received message:', data);
        if (!receivedConnected && data === '"connected"') {
          receivedConnected = true;
          return;
        }
        try {
          expect(JSON.parse(data)).toEqual({ content: 'Hello World', type: 'test' });
          resolved = true;
          clearTimeout(failTimeout);
          es.close();
          resolve();
        } catch (err) {
          resolved = true;
          clearTimeout(failTimeout);
          es.close();
          reject(err);
        }
      };
      es.onerror = err => {
        if (!resolved) {
          resolved = true;
          clearTimeout(failTimeout);
          es.close();
          reject(new Error('SSE message error'));
        }
      };
      setTimeout(() => {
        if (!resolved) {
          console.log('[TEST] Broadcasting test message');
          sseManager.broadcast({ content: 'Hello World', type: 'test' });
        }
      }, 300);
    });
  });

  it('should handle client disconnection', async () => {
    console.log('[SSE TEST] Test: should handle client disconnection');
    await delay(100);
    const es = new EventSource(getSseUrl(port));
    eventSources.push(es);
    let resolved = false;
    await new Promise<void>((resolve, reject) => {
      const failTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          es.close();
          reject(new Error('Timeout'));
        }
      }, 10000);
      failTimeout.unref?.();
      es.onopen = () => {
        if (!resolved) {
          console.log('[SSE TEST] EventSource onopen (disconnection)');
          expect(sseManager.getClientIds().length).toBe(1);
          es.close();
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              console.log('[SSE TEST] Checking client IDs after close');
              expect(sseManager.getClientIds().length).toBe(0);
              clearTimeout(failTimeout);
              resolve();
            }
          }, 100);
        }
      };
      es.onerror = err => {
        if (!resolved) {
          resolved = true;
          clearTimeout(failTimeout);
          es.close();
          console.log('[SSE TEST] EventSource onerror (disconnection)', err);
          reject(new Error('SSE disconnect error'));
        }
      };
    });
  });

  it('should handle multiple clients', async () => {
    const es1 = new EventSource(getSseUrl(port));
    const es2 = new EventSource(getSseUrl(port));
    eventSources.push(es1, es2);
    let received1 = false,
      received2 = false;
    let connected1 = false,
      connected2 = false;
    let resolved = false;
    await new Promise<void>((resolve, reject) => {
      const failTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          es1.close();
          es2.close();
          reject(new Error('Timeout'));
        }
      }, 20000);
      failTimeout.unref?.();
      const checkDone = () => {
        if (received1 && received2 && !resolved) {
          resolved = true;
          clearTimeout(failTimeout);
          es1.close();
          es2.close();
          resolve();
        }
      };
      const messageHandler = (esNum: number) => (event: Event) => {
        if (resolved) return;
        const data = (event as any).data;
        console.log(`[TEST] [multi] es${esNum} received:`, data);
        if (esNum === 1 && !connected1 && data === '"connected"') {
          connected1 = true;
          return;
        }
        if (esNum === 2 && !connected2 && data === '"connected"') {
          connected2 = true;
          return;
        }
        try {
          expect(JSON.parse(data)).toEqual({ content: 'Hello World', type: 'test' });
          if (esNum === 1) received1 = true;
          if (esNum === 2) received2 = true;
          checkDone();
        } catch (err) {
          resolved = true;
          clearTimeout(failTimeout);
          es1.close();
          es2.close();
          reject(err);
        }
      };
      es1.onmessage = messageHandler(1);
      es2.onmessage = messageHandler(2);
      es1.onerror = err => {
        if (!resolved) {
          resolved = true;
          clearTimeout(failTimeout);
          es1.close();
          es2.close();
          reject(new Error('SSE multi-client error 1'));
        }
      };
      es2.onerror = err => {
        if (!resolved) {
          resolved = true;
          clearTimeout(failTimeout);
          es1.close();
          es2.close();
          reject(new Error('SSE multi-client error 2'));
        }
      };
      setTimeout(() => {
        if (!resolved) {
          console.log('[TEST] Broadcasting message to multiple clients');
          sseManager.broadcast({ content: 'Hello World', type: 'test' });
        }
      }, 300);
    });
  });

  it('should handle client errors', async () => {
    if (process.env.SKIP_FLAKY_SSE_ERROR_TEST) {
      console.warn(
        '[SSE TEST] Skipping flaky SSE error test due to SKIP_FLAKY_SSE_ERROR_TEST env var',
      );
      return;
    }
    // This test simulates a client error by forcibly destroying the TCP socket.
    // In some CI environments, this may be flaky; set SKIP_FLAKY_SSE_ERROR_TEST to skip.
    expect.assertions(1);
    await delay(100);
    const es = new EventSource(getSseUrl(port));
    eventSources.push(es);

    await new Promise<void>((resolve, reject) => {
      const failTimeout = setTimeout(() => {
        es.close();
        reject(new Error('Timeout waiting for client error'));
      }, 5000);

      es.onopen = () => {
        // Get the clientId directly from sseManager
        const clientIds = sseManager.getClientIds();
        if (clientIds.length > 0) {
          sseManager.destroyClient(clientIds[0]);
        }
      };

      es.onerror = () => {
        clearTimeout(failTimeout);
        es.close();
        expect(true).toBe(true); // Očekáváme chybu
        resolve();
      };
    });
  });

  it('should clean up stale connections', async () => {
    console.log('[SSE TEST] Test: should clean up stale connections');
    await delay(100);
    const es = new EventSource(getSseUrl(port));
    eventSources.push(es);
    let resolved = false;
    await new Promise<void>((resolve, reject) => {
      const failTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          es.close();
          reject(new Error('Timeout'));
        }
      }, 10000);
      failTimeout.unref?.();
      es.onopen = () => {
        if (!resolved) {
          console.log('[SSE TEST] EventSource onopen (stale cleanup)');
          expect(sseManager.getClientIds().length).toBe(1);
          // Simulate a stale connection by forcing cleanup
          for (const clientId of sseManager.getClientIds()) {
            console.log(`[SSE TEST] Forcing disconnect of client ${clientId}`);
            sseManager.disconnectClient(clientId);
          }
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              console.log('[SSE TEST] Checking client IDs after forced disconnect');
              expect(sseManager.getClientIds().length).toBe(0);
              es.close();
              clearTimeout(failTimeout);
              resolve();
            }
          }, 100);
        }
      };
      es.onerror = err => {
        if (!resolved) {
          resolved = true;
          clearTimeout(failTimeout);
          es.close();
          console.log('[SSE TEST] EventSource onerror (stale cleanup)', err);
          reject(new Error('SSE stale connection error'));
        }
      };
    });
  });
});
