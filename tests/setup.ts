import { jest } from '@jest/globals';
import { resetSseManager } from '../src/sse.js';

// Globální cleanup pro všechny testy
afterAll(async () => {
  // Počkáme na dokončení všech pending operací
  await new Promise(resolve => setTimeout(resolve, 100));

  // Reset SSE manager - to zavře všechny intervaly
  resetSseManager();

  // Zavřeme všechny aktivní timery
  jest.clearAllTimers();

  // Počkáme na dokončení všech mikroúkolů
  await new Promise(resolve => setImmediate(resolve));
});

// Helper funkce pro správné ukončení HTTP serveru
export function closeServer(server: any): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server || !server.close) {
      return resolve();
    }

    const timeout = setTimeout(() => {
      console.warn('Server close timed out. Forcing resolution.');
      resolve();
    }, 500);

    server.keepAliveTimeout = 1;

    server.close((err: any) => {
      clearTimeout(timeout);
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Helper funkce pro správné ukončení EventSource
export function closeEventSource(es: any): Promise<void> {
  return new Promise(resolve => {
    if (!es || !es.close) {
      resolve();
      return;
    }

    es.close();
    // Počkáme na dokončení cleanup
    setTimeout(resolve, 100);
  });
}
