import { z } from 'zod';

const EnvSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(3003),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_SSE: z.coerce.boolean().optional(),
  CORS_ORIGIN: z.string().optional(),
  SSE_PATH: z.string().optional(),
  STORAGE_TYPE: z.enum(['file', 'postgres', 'memory']).default('file'),
  PROMPTS_DIR: z.string().default('/app/data'),
  POSTGRES_HOST: z.string().optional(),
  POSTGRES_PORT: z.coerce.number().optional(),
  POSTGRES_DATABASE: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_MAX_CONNECTIONS: z.coerce.number().optional(),
  POSTGRES_SSL: z.coerce.boolean().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_MODEL_ID: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  ELEVENLABS_CACHE_DIR: z.string().optional(),
});

export type EnvVars = z.infer<typeof EnvSchema>;

export function loadConfig(): EnvVars {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten());
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}

