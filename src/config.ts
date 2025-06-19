import * as path from 'path';
import { z } from 'zod';

import { ServerConfig } from './interfaces.js';

/**
 * Zod schema for all supported environment variables.
 * Uses .coerce for numbers/booleans, provides defaults, and enforces required fields.
 */
export const EnvSchema = z.object({
  BACKUPS_DIR: z.string().default('./data/backups'),
  CORS_ORIGIN: z.string().optional(),
  ENABLE_SSE: z.coerce.boolean().optional(),
  HOST: z.string().default('localhost'),
  HTTP_SERVER: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MCP_SERVER: z.coerce.boolean().default(false),
  MDC_BACKUP_ENABLED: z.coerce.boolean().optional(),
  NAME: z.string().default('mcp-prompts'),

  PORT: z.coerce.number().default(3003),

  POSTGRES_DATABASE: z.string().optional(),

  // Postgres
  POSTGRES_HOST: z.string().optional(),

  // ElasticSearch
ELASTICSEARCH_NODE: z.string().optional(),

  
POSTGRES_MAX_CONNECTIONS: z.coerce.number().optional(),

  PROMPTS_DIR: z.string().default('./data/prompts'),

  ELASTICSEARCH_INDEX: z.string().optional(),

  STORAGE_TYPE: z.enum(['file', 'postgres', 'memory', 'mdc', 'elasticsearch']).default('file'),

  POSTGRES_PASSWORD: z.string().optional(),

  VERSION: z.string().default('1.0.0'),

  ELASTICSEARCH_PASSWORD: z.string().optional(),

  
ELASTICSEARCH_SEQUENCE_INDEX: z.string().optional(),

  // Sequences
SEQUENCES_MAX_STEPS: z.coerce.number().optional(),

  ELASTICSEARCH_USERNAME: z.string().optional(),

  SEQUENCES_RETRY_ATTEMPTS: z.coerce.number().optional(),

  // ElevenLabs
ELEVENLABS_API_KEY: z.string().optional(),

  
SSE_PATH: z.string().optional(),

  ELEVENLABS_CACHE_DIR: z.string().optional(),

  STREAMING_CHUNK_SIZE: z.coerce.number().optional(),

  ELEVENLABS_MODEL_ID: z.string().optional(),

  
ELEVENLABS_OPTIMIZATION_LEVEL: z.enum(['speed', 'quality', 'balanced']).optional(),

  // Streaming
STREAMING_ENABLED: z.coerce.boolean().optional(),

  ELEVENLABS_SIMILARITY_BOOST: z.coerce.number().optional(),

  STREAMING_MAX_TOKENS: z.coerce.number().optional(),

  ELEVENLABS_SPEAKER_BOOST: z.coerce.boolean().optional(),

  SEQUENCES_TIMEOUT: z.coerce.number().optional(),

  ELEVENLABS_STABILITY: z.coerce.number().optional(),

  POSTGRES_PORT: z.coerce.number().optional(),

  ELEVENLABS_STYLE: z.coerce.number().optional(),

  POSTGRES_SSL: z.coerce.boolean().optional(),

  ELEVENLABS_USE_CACHING: z.coerce.boolean().optional(),

  ELEVENLABS_VOICE_ID: z.string().optional(),

  POSTGRES_USER: z.string().optional(),

  MDC_BACKUP_INTERVAL: z.coerce.number().optional(),
  // MDC
  MDC_RULES_DIR: z.string().optional(),
});

export type EnvVars = z.infer<typeof EnvSchema>;

/**
 * Loads and validates the server configuration from environment variables using Zod.
 * Throws a clear error and exits if validation fails.
 */
export function loadConfig(): EnvVars {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    // Format Zod errors for clarity
    const errors = result.error.errors.map(e => `- ${e.path.join('.')}: ${e.message}`);
    console.error('\n❌ Invalid or missing environment variables:\n' + errors.join('\n'));
    process.exit(1);
  }
  return result.data;
}
