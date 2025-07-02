"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.McpConfigSchema = exports.EnvSchema = void 0;
exports.loadConfig = loadConfig;
const zod_1 = require("zod");
/**
 * Zod schema for all supported environment variables.
 * Uses .coerce for numbers/booleans, provides defaults, and enforces required fields.
 */
exports.EnvSchema = zod_1.z.object({
    BACKUPS_DIR: zod_1.z.string().default('./data/backups'),
    CORS_ORIGIN: zod_1.z.string().optional(),
    ELASTICSEARCH_INDEX: zod_1.z.string().optional(),
    // ElasticSearch
    ELASTICSEARCH_NODE: zod_1.z.string().optional(),
    ELASTICSEARCH_PASSWORD: zod_1.z.string().optional(),
    ELASTICSEARCH_SEQUENCE_INDEX: zod_1.z.string().optional(),
    ELASTICSEARCH_USERNAME: zod_1.z.string().optional(),
    // ElevenLabs
    ELEVENLABS_API_KEY: zod_1.z.string().optional(),
    ELEVENLABS_CACHE_DIR: zod_1.z.string().optional(),
    ELEVENLABS_MODEL_ID: zod_1.z.string().optional(),
    ELEVENLABS_OPTIMIZATION_LEVEL: zod_1.z.enum(['speed', 'quality', 'balanced']).optional(),
    ELEVENLABS_SIMILARITY_BOOST: zod_1.z.coerce.number().optional(),
    ELEVENLABS_SPEAKER_BOOST: zod_1.z.coerce.boolean().optional(),
    ELEVENLABS_STABILITY: zod_1.z.coerce.number().optional(),
    ELEVENLABS_STYLE: zod_1.z.coerce.number().optional(),
    ELEVENLABS_USE_CACHING: zod_1.z.coerce.boolean().optional(),
    ELEVENLABS_VOICE_ID: zod_1.z.string().optional(),
    ENABLE_SSE: zod_1.z.coerce.boolean().optional(),
    HOST: zod_1.z.string().default('localhost'),
    HTTP_SERVER: zod_1.z.coerce.boolean().default(true),
    LOG_LEVEL: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    MCP_SERVER: zod_1.z.coerce.boolean().default(false),
    MDC_BACKUP_ENABLED: zod_1.z.coerce.boolean().optional(),
    MDC_BACKUP_INTERVAL: zod_1.z.coerce.number().optional(),
    // MDC
    MDC_RULES_DIR: zod_1.z.string().optional(),
    NAME: zod_1.z.string().default('mcp-prompts'),
    PORT: zod_1.z.coerce.number().default(3003),
    POSTGRES_DATABASE: zod_1.z.string().optional(),
    // Postgres
    POSTGRES_HOST: zod_1.z.string().optional(),
    POSTGRES_MAX_CONNECTIONS: zod_1.z.coerce.number().optional(),
    POSTGRES_PASSWORD: zod_1.z.string().optional(),
    POSTGRES_PORT: zod_1.z.coerce.number().optional(),
    POSTGRES_SSL: zod_1.z.coerce.boolean().optional(),
    POSTGRES_USER: zod_1.z.string().optional(),
    PROMPTS_DIR: zod_1.z.string().default('./data/prompts'),
    // Sequences
    SEQUENCES_MAX_STEPS: zod_1.z.coerce.number().optional(),
    SEQUENCES_RETRY_ATTEMPTS: zod_1.z.coerce.number().optional(),
    SEQUENCES_TIMEOUT: zod_1.z.coerce.number().optional(),
    SSE_PATH: zod_1.z.string().optional(),
    STORAGE_TYPE: zod_1.z.enum(['file', 'postgres', 'memory', 'mdc', 'elasticsearch']).default('file'),
    STREAMING_CHUNK_SIZE: zod_1.z.coerce.number().optional(),
    // Streaming
    STREAMING_ENABLED: zod_1.z.coerce.boolean().optional(),
    STREAMING_MAX_TOKENS: zod_1.z.coerce.number().optional(),
    VERSION: zod_1.z.string().default('1.0.0'),
    redis: zod_1.z
        .object({
        db: zod_1.z.coerce.number().optional(),
        host: zod_1.z.string().optional(),
        password: zod_1.z.string().optional(),
        port: zod_1.z.coerce.number().optional(),
        ttl: zod_1.z.coerce.number().optional(),
    })
        .optional(),
});
exports.McpConfigSchema = exports.EnvSchema.extend({
    storage: zod_1.z.object({
        database: zod_1.z.string().optional(),
        host: zod_1.z.string().optional(),
        maxConnections: zod_1.z.number().optional(),
        password: zod_1.z.string().optional(),
        port: zod_1.z.number().optional(),
        promptsDir: zod_1.z.string(),
        ssl: zod_1.z.boolean().optional(),
        type: zod_1.z.enum(['file', 'memory', 'postgres']),
        user: zod_1.z.string().optional(),
    }),
});
/**
 * Loads and validates the server configuration from environment variables using Zod.
 * Throws a clear error and exits if validation fails.
 */
function loadConfig() {
    const result = exports.EnvSchema.safeParse(process.env);
    if (!result.success) {
        // Format Zod errors for clarity
        const errors = result.error.errors.map(e => `- ${e.path.join('.')}: ${e.message}`);
        console.error('\n❌ Invalid or missing environment variables:\n' + errors.join('\n'));
        process.exit(1);
    }
    return result.data;
}
exports.config = loadConfig();
