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
    app.get('/events', (req, res) => sseManager.handleConnection(req, res));
    server = app.listen(0, () => {
      // @ts-ignore
      port = server.address().port;
      done();
    });
  });

  afterAll(async () => {
    await Promise.all(eventSources.map(es => closeEventSource(es)));
    await new Promise(resolve => server.close(resolve));
  });

  afterEach(async () => {
    for (const clientId of sseManager.getClientIds()) {
      await sseManager.disconnectClient(clientId);
    }
    await Promise.all(eventSources.map(es => closeEventSource(es)));
    eventSources = [];
  });

  it('should establish SSE connection', done => {
    const es = new EventSource(`http://localhost:${port}/events`);
    eventSources.push(es);
    const failTimeout = setTimeout(() => done(new Error('Timeout')), 10000);
    es.onopen = () => {
      expect(sseManager.getClientIds().length).toBe(1);
      es.close();
      clearTimeout(failTimeout);
      done();
    };
    es.onerror = (err) => {
      clearTimeout(failTimeout);
      done(new Error('SSE connection error'));
    };
  });

  it('should send and receive messages', done => {
    const es = new EventSource(`http://localhost:${port}/events`);
    eventSources.push(es);
    const failTimeout = setTimeout(() => done(new Error('Timeout')), 10000);
    es.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      expect(data).toEqual({ type: 'test', content: 'Hello World' });
      es.close();
      clearTimeout(failTimeout);
      done();
    };
    es.onerror = (err) => {
      clearTimeout(failTimeout);
      done(new Error('SSE message error'));
    };
    setTimeout(() => {
      sseManager.broadcast({ type: 'test', content: 'Hello World' });
    }, 100);
  });

  it('should handle client disconnection', done => {
    const es = new EventSource(`http://localhost:${port}/events`);
    eventSources.push(es);
    const failTimeout = setTimeout(() => done(new Error('Timeout')), 10000);
    es.onopen = () => {
      expect(sseManager.getClientIds().length).toBe(1);
      es.close();
      setTimeout(() => {
        expect(sseManager.getClientIds().length).toBe(0);
        clearTimeout(failTimeout);
        done();
      }, 100);
    };
    es.onerror = (err) => {
      clearTimeout(failTimeout);
      done(new Error('SSE disconnect error'));
    };
  });

  it('should handle multiple clients', done => {
    const es1 = new EventSource(`http://localhost:${port}/events`);
    const es2 = new EventSource(`http://localhost:${port}/events`);
    eventSources.push(es1, es2);
    let messageCount = 0;
    const expectedMessages = 2;
    const failTimeout = setTimeout(() => done(new Error('Timeout')), 10000);
    const messageHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      expect(data).toEqual({ type: 'test', content: 'Hello World' });
      messageCount++;
      if (messageCount === expectedMessages) {
        es1.close();
        es2.close();
        clearTimeout(failTimeout);
        done();
      }
    };
    es1.onmessage = messageHandler;
    es2.onmessage = messageHandler;
    es1.onerror = (err) => {
      clearTimeout(failTimeout);
      done(new Error('SSE multi-client error 1'));
    };
    es2.onerror = (err) => {
      clearTimeout(failTimeout);
      done(new Error('SSE multi-client error 2'));
    };
    setTimeout(() => {
      sseManager.broadcast({ type: 'test', content: 'Hello World' });
    }, 100);
  });

  it('should handle client errors', done => {
    const es = new EventSource(`http://localhost:${port}/events`);
    eventSources.push(es);
    const failTimeout = setTimeout(() => done(new Error('Timeout')), 10000);
    es.onerror = (err) => {
      expect(sseManager.getClientIds().length).toBe(0);
      clearTimeout(failTimeout);
      done();
    };
    es.onopen = () => {
      expect(sseManager.getClientIds().length).toBe(1);
      server.close(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        server = app.listen(0, () => {
          // @ts-ignore
          port = server.address().port;
          es.close();
        });
      });
    };
  });

  it('should clean up stale connections', done => {
    const es = new EventSource(`http://localhost:${port}/events`);
    eventSources.push(es);
    const failTimeout = setTimeout(() => done(new Error('Timeout')), 10000);
    es.onopen = () => {
      expect(sseManager.getClientIds().length).toBe(1);
      // Simulate a stale connection by forcing cleanup
      for (const clientId of sseManager.getClientIds()) {
        sseManager.disconnectClient(clientId);
      }
      setTimeout(() => {
        expect(sseManager.getClientIds().length).toBe(0);
        es.close();
        clearTimeout(failTimeout);
        done();
      }, 100);
    };
    es.onerror = (err) => {
      clearTimeout(failTimeout);
      done(new Error('SSE stale connection error'));
    };
  });
}); 