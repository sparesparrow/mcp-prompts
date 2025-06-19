import * as path from 'path';
import { ServerConfig } from './interfaces.js';
import { z } from 'zod';

/**
 * Loads the server configuration from environment variables and provides default values.
 */
export const ConfigSchema = z.object({
  name: z.string().default('mcp-prompts'),
  version: z.string().default('1.0.0'),
  storageType: z.enum(['file', 'postgres', 'memory', 'mdc', 'elasticsearch']).default('file'),
  promptsDir: z.string().default('./data/prompts'),
  backupsDir: z.string().default('./data/backups'),
  port: z.number().default(3003),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  httpServer: z.boolean().default(true),
  mcpServer: z.boolean().default(false),
  host: z.string().default('localhost'),
  enableSSE: z.boolean().optional(),
  ssePath: z.string().optional(),
  corsOrigin: z.string().optional(),
  streaming: z.object({
    enabled: z.boolean().default(true),
    chunkSize: z.number().default(100),
    maxTokens: z.number().optional(),
  }).optional(),
  sequences: z.object({
    maxSteps: z.number().default(10),
    timeout: z.number().default(30000),
    retryAttempts: z.number().default(3),
  }).optional(),
  elevenlabs: z.object({
    enabled: z.boolean().default(false),
    apiKey: z.string().optional(),
    modelId: z.string().optional(),
    voiceId: z.string().optional(),
    optimizationLevel: z.enum(['speed', 'quality', 'balanced']).default('balanced'),
    stability: z.number().min(0).max(1).default(0.75),
    similarityBoost: z.number().min(0).max(1).default(0.75),
    speakerBoost: z.boolean().default(true),
    style: z.number().min(0).max(1).default(0),
    useCaching: z.boolean().default(true),
    cachePath: z.string().optional()
  }).optional(),
  postgres: z.object({
    host: z.string(),
    port: z.number(),
    database: z.string(),
    user: z.string(),
    password: z.string(),
    ssl: z.boolean().optional(),
    maxConnections: z.number().optional(),
  }).optional(),
  mdc: z.object({
    rulesDir: z.string(),
    backupEnabled: z.boolean().optional(),
    backupInterval: z.number().optional(),
  }).optional(),
  elasticsearch: z.object({
    node: z.string(),
    auth: z.object({
      username: z.string(),
      password: z.string(),
    }).optional(),
    index: z.string().optional(),
    sequenceIndex: z.string().optional(),
  }).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const config: Partial<Config> = {
    name: process.env.NAME,
    version: process.env.VERSION,
    storageType: process.env.STORAGE_TYPE as Config['storageType'],
    promptsDir: process.env.PROMPTS_DIR,
    backupsDir: process.env.BACKUPS_DIR,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    logLevel: process.env.LOG_LEVEL as Config['logLevel'],
    httpServer: process.env.HTTP_SERVER === 'true',
    mcpServer: process.env.MCP_SERVER === 'true',
    host: process.env.HOST,
    enableSSE: process.env.ENABLE_SSE === 'true',
    ssePath: process.env.SSE_PATH,
    corsOrigin: process.env.CORS_ORIGIN,
  };

  if (process.env.STREAMING_ENABLED) {
    config.streaming = {
      enabled: process.env.STREAMING_ENABLED === 'true',
      chunkSize: process.env.STREAMING_CHUNK_SIZE ? parseInt(process.env.STREAMING_CHUNK_SIZE, 10) : 100,
      maxTokens: process.env.STREAMING_MAX_TOKENS ? parseInt(process.env.STREAMING_MAX_TOKENS, 10) : undefined,
    };
  }

  if (process.env.SEQUENCES_MAX_STEPS) {
    config.sequences = {
      maxSteps: parseInt(process.env.SEQUENCES_MAX_STEPS, 10),
      timeout: process.env.SEQUENCES_TIMEOUT ? parseInt(process.env.SEQUENCES_TIMEOUT, 10) : 30000,
      retryAttempts: process.env.SEQUENCES_RETRY_ATTEMPTS ? parseInt(process.env.SEQUENCES_RETRY_ATTEMPTS, 10) : 3,
    };
  }

  if (process.env.POSTGRES_HOST) {
    config.postgres = {
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DATABASE || 'mcp_prompts',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
      ssl: process.env.POSTGRES_SSL === 'true',
      maxConnections: process.env.POSTGRES_MAX_CONNECTIONS ? parseInt(process.env.POSTGRES_MAX_CONNECTIONS, 10) : undefined,
    };
  }

  if (process.env.MDC_RULES_DIR) {
    config.mdc = {
      rulesDir: process.env.MDC_RULES_DIR,
      backupEnabled: process.env.MDC_BACKUP_ENABLED === 'true',
      backupInterval: process.env.MDC_BACKUP_INTERVAL ? parseInt(process.env.MDC_BACKUP_INTERVAL, 10) : undefined,
    };
  }

  if (process.env.ELASTICSEARCH_NODE) {
    config.elasticsearch = {
      node: process.env.ELASTICSEARCH_NODE,
      auth: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD ? {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
      } : undefined,
      index: process.env.ELASTICSEARCH_INDEX,
      sequenceIndex: process.env.ELASTICSEARCH_SEQUENCE_INDEX,
    };
  }

  if (process.env.ELEVENLABS_API_KEY) {
    config.elevenlabs = {
      enabled: true,
      optimizationLevel: (process.env.ELEVENLABS_OPTIMIZATION_LEVEL || 'balanced') as 'speed' | 'quality' | 'balanced',
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: process.env.ELEVENLABS_VOICE_ID,
      modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_monolingual_v1',
      stability: process.env.ELEVENLABS_STABILITY ? parseFloat(process.env.ELEVENLABS_STABILITY) : 0.75,
      similarityBoost: process.env.ELEVENLABS_SIMILARITY_BOOST ? parseFloat(process.env.ELEVENLABS_SIMILARITY_BOOST) : 0.75,
      style: process.env.ELEVENLABS_STYLE ? parseFloat(process.env.ELEVENLABS_STYLE) : 0.5,
      speakerBoost: process.env.ELEVENLABS_SPEAKER_BOOST !== 'false',
      useCaching: process.env.ELEVENLABS_USE_CACHING !== 'false',
      cachePath: process.env.ELEVENLABS_CACHE_DIR || './data/audio-cache',
    };
  }

  return ConfigSchema.parse(config);
} 