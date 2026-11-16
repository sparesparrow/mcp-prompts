import * as fs from 'fs';
import { z } from 'zod';

// Settings of the HTTP entry point. What the server serves (selection, capabilities, read-only,
// directories) comes from server-options.ts and is shared with the stdio entry point.

// z.coerce.boolean() turns every non-empty string into true, "false" and "0" included.
const BooleanEnv = z
  .string()
  .trim()
  .toLowerCase()
  .refine(value => ['true', '1', 'yes', 'on', 'false', '0', 'no', 'off', ''].includes(value), 'must be true or false')
  .transform(value => ['true', '1', 'yes', 'on'].includes(value));

const ListEnv = z.string().transform(value => value.split(',').map(entry => entry.trim()).filter(Boolean));

const EnvSchema = z.object({
  // Loopback unless told otherwise: the HTTP API can change prompts, and prompts are instructions
  // agents act on. Containers set HOST=0.0.0.0 themselves.
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3003),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  CORS_ORIGIN: z.string().trim().min(1).optional(),
  MCP_PROMPTS_AUTH_TOKEN: z.string().optional(),
  MCP_PROMPTS_AUTH_TOKEN_FILE: z.string().trim().min(1).optional(),
  MCP_PROMPTS_ALLOWED_HOSTS: ListEnv.optional(),
  MCP_PROMPTS_ALLOWED_ORIGINS: ListEnv.optional(),
  MCP_PROMPTS_ALLOW_INSECURE: BooleanEnv.optional(),
});

export interface HttpConfig {
  host: string;
  port: number;
  corsOrigin?: string;
  /** Bearer token clients must send; undefined leaves the server open to whoever can reach it. */
  authToken?: string;
  allowedHosts?: string[];
  allowedOrigins: string[];
  /** Accept writes from beyond loopback without a token (for a server behind its own auth proxy). */
  allowInsecure: boolean;
}

/** A setting is missing or invalid; the message names it. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export const MIN_TOKEN_LENGTH = 16;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): HttpConfig {
  // An empty variable (HOST= in a compose file) counts as unset.
  const set = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined && value !== ''));
  const parsed = EnvSchema.safeParse(set);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
    throw new ConfigError(`invalid environment: ${problems.join('; ')}`);
  }
  const data = parsed.data;

  let authToken = data.MCP_PROMPTS_AUTH_TOKEN?.trim() || undefined;
  if (data.MCP_PROMPTS_AUTH_TOKEN_FILE) {
    if (authToken) throw new ConfigError('set MCP_PROMPTS_AUTH_TOKEN or MCP_PROMPTS_AUTH_TOKEN_FILE, not both');
    try {
      authToken = fs.readFileSync(data.MCP_PROMPTS_AUTH_TOKEN_FILE, 'utf8').trim() || undefined;
    } catch (error) {
      throw new ConfigError(`cannot read MCP_PROMPTS_AUTH_TOKEN_FILE: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!authToken) throw new ConfigError(`MCP_PROMPTS_AUTH_TOKEN_FILE ${data.MCP_PROMPTS_AUTH_TOKEN_FILE} is empty`);
  }
  if (authToken !== undefined && authToken.length < MIN_TOKEN_LENGTH) {
    throw new ConfigError(`the auth token must be at least ${MIN_TOKEN_LENGTH} characters (for example: openssl rand -hex 32)`);
  }

  return {
    host: data.HOST,
    port: data.PORT,
    corsOrigin: data.CORS_ORIGIN,
    authToken,
    allowedHosts: data.MCP_PROMPTS_ALLOWED_HOSTS && data.MCP_PROMPTS_ALLOWED_HOSTS.length > 0 ? data.MCP_PROMPTS_ALLOWED_HOSTS : undefined,
    allowedOrigins: data.MCP_PROMPTS_ALLOWED_ORIGINS ?? [],
    allowInsecure: data.MCP_PROMPTS_ALLOW_INSECURE ?? false,
  };
}
