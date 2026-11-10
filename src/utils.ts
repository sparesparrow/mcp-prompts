import { pino } from 'pino';

// For MCP servers using stdio transport, logs must go to stderr, not stdout
// stdout is reserved for JSON-RPC messages
const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
const requestedLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();

// Call it as logger.error({ err }, 'what failed'): pino drops an error passed after the message.
export const logger = pino({
  // An unknown level made pino throw while the module loaded, before any message could say why.
  level: LEVELS.includes(requestedLevel) ? requestedLevel : 'info'
}, process.stderr);

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function sanitizeString(str: string): string {
  return str.replace(/[^a-zA-Z0-9-_]/g, '_');
}
