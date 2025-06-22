import * as path from 'path';
import { z } from 'zod';

/**
 * Zod schema for all supported environment variables.
 * Uses .coerce for numbers/booleans, provides defaults, and enforces required fields.
 */
export const EnvSchema = z.object({
  BACKUPS_DIR: z.string().default('./data/backups'),
  CORS_ORIGIN: z.string().optional(),

  ELASTICSEARCH_INDEX: z.string().optional(),

  // ElasticSearch
  ELASTICSEARCH_NODE: z.string().optional(),

  ELASTICSEARCH_PASSWORD: z.string().optional(),

  ELASTICSEARCH_SEQUENCE_INDEX: z.string().optional(),

  ELASTICSEARCH_USERNAME: z.string().optional(),

  // ElevenLabs
  ELEVENLABS_API_KEY: z.string().optional(),

  ELEVENLABS_CACHE_DIR: z.string().optional(),

  ELEVENLABS_MODEL_ID: z.string().optional(),

  ELEVENLABS_OPTIMIZATION_LEVEL: z.enum(['speed', 'quality', 'balanced']).optional(),

  ELEVENLABS_SIMILARITY_BOOST: z.coerce.number().optional(),

  ELEVENLABS_SPEAKER_BOOST: z.coerce.boolean().optional(),

  ELEVENLABS_STABILITY: z.coerce.number().optional(),

  ELEVENLABS_STYLE: z.coerce.number().optional(),

  ELEVENLABS_USE_CACHING: z.coerce.boolean().optional(),

  ELEVENLABS_VOICE_ID: z.string().optional(),

  ENABLE_SSE: z.coerce.boolean().optional(),

  HOST: z.string().default('localhost'),

  HTTP_SERVER: z.coerce.boolean().default(true),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  MCP_SERVER: z.coerce.boolean().default(false),

  MDC_BACKUP_ENABLED: z.coerce.boolean().optional(),

  MDC_BACKUP_INTERVAL: z.coerce.number().optional(),

  // MDC
  MDC_RULES_DIR: z.string().optional(),

  NAME: z.string().default('mcp-prompts'),

  PORT: z.coerce.number().default(3003),

  POSTGRES_DATABASE: z.string().optional(),

  // Postgres
  POSTGRES_HOST: z.string().optional(),

  POSTGRES_MAX_CONNECTIONS: z.coerce.number().optional(),

  POSTGRES_PASSWORD: z.string().optional(),

  POSTGRES_PORT: z.coerce.number().optional(),

  POSTGRES_SSL: z.coerce.boolean().optional(),

  POSTGRES_USER: z.string().optional(),

  PROMPTS_DIR: z.string().default('./data/prompts'),

  // Sequences
  SEQUENCES_MAX_STEPS: z.coerce.number().optional(),

  SEQUENCES_RETRY_ATTEMPTS: z.coerce.number().optional(),

  SEQUENCES_TIMEOUT: z.coerce.number().optional(),

  SSE_PATH: z.string().optional(),

  STORAGE_TYPE: z.enum(['file', 'postgres', 'memory', 'mdc', 'elasticsearch']).default('file'),

  STREAMING_CHUNK_SIZE: z.coerce.number().optional(),

  // Streaming
  STREAMING_ENABLED: z.coerce.boolean().optional(),

  STREAMING_MAX_TOKENS: z.coerce.number().optional(),

  VERSION: z.string().default('1.0.0'),

  redis: z
    .object({
      db: z.coerce.number().optional(),
      host: z.string().optional(),
      password: z.string().optional(),
      port: z.coerce.number().optional(),
      ttl: z.coerce.number().optional(),
    })
    .optional(),
});

export type EnvVars = z.infer<typeof EnvSchema>;

export const McpConfigSchema = EnvSchema.extend({
  storage: z.object({
    database: z.string().optional(),
    host: z.string().optional(),
    maxConnections: z.number().optional(),
    password: z.string().optional(),
    port: z.number().optional(),
    promptsDir: z.string(),
    ssl: z.boolean().optional(),
    type: z.enum(['file', 'memory', 'postgres']),
    user: z.string().optional(),
  }),
});

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

export const config = loadConfig();
