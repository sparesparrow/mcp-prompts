import Redis from 'ioredis';
import { config } from './config';

let redisClient: Redis | null = null;

/**
 * Returns a singleton Redis client, initialized from config.
 */
export function getRedisClient(): Redis | null {
  if (!config.redis || !config.redis.host) return null;
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      lazyConnect: true,
    });
    redisClient.on('error', (err: Error) => {
      console.error('[Redis] Connection error:', err);
    });
  }
  return redisClient;
}

/**
 * Applies variables to a string template.
 *
 * Replaces all instances of `{{variable_name}}` with the corresponding value
 * from the variables record. If a variable is not found, the placeholder
 * is left unchanged.
 * @param content The template string.
 * @param variables A record of variable names to their values.
 * @returns The content with variables substituted.
 */
export function applyTemplate(content: string, variables: Record<string, string>): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
    const key = variableName.trim();
    return variables[key] ?? match;
  });
}
