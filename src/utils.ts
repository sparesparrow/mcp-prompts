import { pino } from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function sanitizeString(str: string): string {
  return str.replace(/[^a-zA-Z0-9-_]/g, '_');
}
