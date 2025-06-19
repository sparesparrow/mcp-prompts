import { jest } from '@jest/globals';
jest.setTimeout(60000);
import express from 'express';
import { Server } from 'node:http';
import { SseManager, getSseManager, resetSseManager } from '../sse.js';
import { EventSource } from 'eventsource';
import * as sseModule from '../sse.js';

type SseOptions = {
  enableCompression?: boolean;
  compressionMinSize?: number;
  messageHistory?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
};

describe('SseManager', () => {
  let app: express.Application;
  let server: Server;
  let sseManager: SseManager;
  let port: number;
  let eventSources: EventSource[] = [];

  async function closeEventSource(es: EventSource): Promise<void> {
    return new Promise(resolve => {
      es.close();
      setTimeout(resolve, 100); // Wait a bit for closure
    });
  }

  beforeAll(done => {
    resetSseManager();
    const options: SseOptions = {
      enableCompression: true,
      compressionMinSize: 1024,
      messageHistory: 100,
      heartbeatInterval: 30000,
      connectionTimeout: 60000,
      maxRetries: 3,
      retryDelay: 1000,
    };
    sseManager = getSseManager(options);
    app = express();
    app.get('/events', (req, res) => {
      console.log('[SSE TEST] /events route hit');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      sseManager.handleConnection(req, res);
    });
    server = app.listen(0, () => {
      // @ts-ignore
      port = server.address().port;
      console.log(`[SSE TEST] Server started on port ${port}`);
      done();
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
    await Promise.all(eventSources.map(async (es, i) => {
      console.log(`[SSE TEST] Closing EventSource #${i}`);
      await closeEventSource(es);
    }));
    await new Promise(resolve => server.close(() => {
      console.log('[SSE TEST] Server closed');
      resolve(undefined);
    }));
  });

  afterEach(async () => {
    console.log('[TEST] afterEach: cleaning up EventSources and clients');
    for (const clientId of sseManager.getClientIds()) {
      await sseManager.disconnectClient(clientId);
    }
    for (const es of eventSources) {
      await closeEventSource(es);
    }
    eventSources.length = 0;
    console.log('[TEST] afterEach: cleanup complete');
  });

  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  it('should establish SSE connection', done => {
    console.log('[TEST] should establish SSE connection: started');
    const es = new EventSource(`http://127.0.0.1:${port}/events`);
    eventSources.push(es);
    const failTimeout = setTimeout(() => {
      console.log('[TEST] should establish SSE connection: timeout');
      console.log('[TEST] SseManager client IDs:', sseManager.getClientIds());
      done(new Error('Timeout'));
    }, 20000);
    es.onopen = () => {
      console.log('[TEST] should establish SSE connection: onopen');
    };
    es.onmessage = (event: MessageEvent) => {
      console.log('[TEST] should establish SSE connection: onmessage', event.data);
      if (event.data === '"connected"') {
        clearTimeout(failTimeout);
        es.close();
        console.log('[TEST] should establish SSE connection: done() called');
        done();
      }
    };
    es.onerror = err => {
      clearTimeout(failTimeout);
      console.log('[TEST] should establish SSE connection: onerror', err);
      done(new Error('SSE error'));
    };
  });

  it('should send and receive messages', done => {
    const es = new EventSource(`http://127.0.0.1:${port}/events`);
    eventSources.push(es);
    let receivedConnected = false;
    es.onmessage = (event: MessageEvent) => {
      console.log('[TEST] Received message:', event.data);
      if (!receivedConnected && event.data === '"connected"') {
        receivedConnected = true;
        return;
      }
      const data = JSON.parse(event.data);
      expect(data).toEqual({ type: 'test', content: 'Hello World' });
      es.close();
      done();
    };
    es.onerror = err => {
      done(new Error('SSE message error'));
    };
    setTimeout(() => {
      console.log('[TEST] Broadcasting test message');
      sseManager.broadcast({ type: 'test', content: 'Hello World' });
    }, 300);
  });

  it('should handle client disconnection', (done) => {
    (async () => {
      console.log('[SSE TEST] Test: should handle client disconnection');
      await delay(100);
      const es = new EventSource(`http://127.0.0.1:${port}/events`);
      eventSources.push(es);
      const failTimeout = setTimeout(() => {
        console.log('[SSE TEST] Timeout waiting for disconnection');
        done(new Error('Timeout'));
      }, 10000);
      es.onopen = () => {
        console.log('[SSE TEST] EventSource onopen (disconnection)');
        expect(sseManager.getClientIds().length).toBe(1);
        es.close();
        setTimeout(() => {
          console.log('[SSE TEST] Checking client IDs after close');
          expect(sseManager.getClientIds().length).toBe(0);
          clearTimeout(failTimeout);
          done();
        }, 100);
      };
      es.onerror = (err) => {
        console.log('[SSE TEST] EventSource onerror (disconnection)', err);
        clearTimeout(failTimeout);
        done(new Error('SSE disconnect error'));
      };
    })();
  });

  it('should handle multiple clients', done => {
    const es1 = new EventSource(`http://127.0.0.1:${port}/events`);
    const es2 = new EventSource(`http://127.0.0.1:${port}/events`);
    eventSources.push(es1, es2);
    let received1 = false, received2 = false;
    let connected1 = false, connected2 = false;
    const checkDone = () => {
      if (received1 && received2) {
        es1.close();
        es2.close();
        done();
      }
    };
    const messageHandler = (esNum: number) => (event: MessageEvent) => {
      console.log(`[TEST] [multi] es${esNum} received:`, event.data);
      if ((esNum === 1 && !connected1 && event.data === '"connected"')) {
        connected1 = true;
        return;
      }
      if ((esNum === 2 && !connected2 && event.data === '"connected"')) {
        connected2 = true;
        return;
      }
      const data = JSON.parse(event.data);
      expect(data).toEqual({ type: 'test', content: 'Hello World' });
      if (esNum === 1) received1 = true;
      if (esNum === 2) received2 = true;
      checkDone();
    };
    es1.onmessage = messageHandler(1);
    es2.onmessage = messageHandler(2);
    es1.onerror = err => done(new Error('SSE multi-client error 1'));
    es2.onerror = err => done(new Error('SSE multi-client error 2'));
    setTimeout(() => {
      console.log('[TEST] Broadcasting message to multiple clients');
      sseManager.broadcast({ type: 'test', content: 'Hello World' });
    }, 300);
  });

  it('should handle client errors', (done) => {
    (async () => {
      console.log('[SSE TEST] Test: should handle client errors');
      await delay(100);
      const es = new EventSource(`http://127.0.0.1:${port}/events`);
      eventSources.push(es);
      const failTimeout = setTimeout(() => {
        console.log('[SSE TEST] Timeout waiting for client error');
        done(new Error('Timeout'));
      }, 10000);
      es.onerror = (err) => {
        console.log('[SSE TEST] EventSource onerror (client error)', err);
        expect(sseManager.getClientIds().length).toBe(0);
        clearTimeout(failTimeout);
        done();
      };
      es.onopen = () => {
        console.log('[SSE TEST] EventSource onopen (client error)');
        expect(sseManager.getClientIds().length).toBe(1);
        server.close(async () => {
          console.log('[SSE TEST] Server closed (client error)');
          await new Promise(resolve => setTimeout(resolve, 100));
          server = app.listen(0, () => {
            // @ts-ignore
            port = server.address().port;
            es.close();
          });
        });
      };
    })();
  });

  it('should clean up stale connections', (done) => {
    (async () => {
      console.log('[SSE TEST] Test: should clean up stale connections');
      await delay(100);
      const es = new EventSource(`http://127.0.0.1:${port}/events`);
      eventSources.push(es);
      const failTimeout = setTimeout(() => {
        console.log('[SSE TEST] Timeout waiting for stale connection cleanup');
        done(new Error('Timeout'));
      }, 10000);
      es.onopen = () => {
        console.log('[SSE TEST] EventSource onopen (stale cleanup)');
        expect(sseManager.getClientIds().length).toBe(1);
        // Simulate a stale connection by forcing cleanup
        for (const clientId of sseManager.getClientIds()) {
          console.log(`[SSE TEST] Forcing disconnect of client ${clientId}`);
          sseManager.disconnectClient(clientId);
        }
        setTimeout(() => {
          console.log('[SSE TEST] Checking client IDs after forced disconnect');
          expect(sseManager.getClientIds().length).toBe(0);
          es.close();
          clearTimeout(failTimeout);
          done();
        }, 100);
      };
      es.onerror = (err) => {
        console.log('[SSE TEST] EventSource onerror (stale cleanup)', err);
        clearTimeout(failTimeout);
        done(new Error('SSE stale connection error'));
      };
    })();
  });
});

describe('Minimal SSE Environment Test', () => {
  let app: express.Application, server: Server, port: number;

  beforeAll(done => {
    app = express();
    app.get('/sse', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(': connected\n\n'); // comment to flush
      res.write(`data: {\"hello\":\"world\"}\n\n`);
      req.on('close', () => {
        console.log('[MINIMAL SSE] Client disconnected');
      });
    });
    server = app.listen(0, () => {
      // @ts-ignore
      port = server.address().port;
      console.log('[MINIMAL SSE] Server started on port', port);
      setTimeout(done, 100); // ensure server is ready
    });
  });

  afterAll(done => {
    server.close(() => {
      console.log('[MINIMAL SSE] Server closed');
      done();
    });
  });

  it('should receive SSE message', done => {
    const url = `http://127.0.0.1:${port}/sse`;
    const es = new EventSource(url);
    es.onopen = () => {
      console.log('[MINIMAL SSE] EventSource open');
    };
    es.onmessage = (event: MessageEvent) => {
      console.log('[MINIMAL SSE] Received message:', event.data);
      expect(event.data).toBe('{"hello":"world"}');
      es.close();
      done();
    };
    es.onerror = err => {
      done(new Error('[MINIMAL SSE] EventSource error: ' + JSON.stringify(err)));
    };
  });
}); 