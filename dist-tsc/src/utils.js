import { Redis } from 'ioredis';
import { config } from './config.js';
let redisClient = null;
/**
 * Returns a singleton Redis client, initialized from config.
 */
export function getRedisClient() {
    if (!config.redis || !config.redis.host)
        return null;
    if (!redisClient) {
        redisClient = new Redis({
            db: config.redis.db,
            host: config.redis.host,
            lazyConnect: true,
            password: config.redis.password,
            port: config.redis.port,
        });
        redisClient.on('error', (err) => {
            console.error('[Redis] Connection error:', err);
        });
    }
    return redisClient;
}
/**
 * Closes the singleton Redis client connection.
 */
export async function closeRedisClient() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
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
export function applyTemplate(content, variables) {
    return content.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
        const key = variableName.trim();
        return variables[key] ?? match;
    });
}
/**
 * A replacer function for JSON.stringify to correctly serialize Error objects.
 * @param _key The key being replaced.
 * @param value The value to replace.
 * @returns A serializable representation of the Error object, or the original value.
 */
export function jsonFriendlyErrorReplacer(_key, value) {
    if (value instanceof Error) {
        return {
            message: value.message,
            name: value.name,
            stack: value.stack,
        };
    }
    return value;
}
export const templateHelpers = {
    toUpperCase: (str) => (typeof str === 'string' ? str.toUpperCase() : ''),
    toLowerCase: (str) => (typeof str === 'string' ? str.toLowerCase() : ''),
    jsonStringify: (context) => JSON.stringify(context, jsonFriendlyErrorReplacer, 2),
    join: (arr, sep) => {
        if (!Array.isArray(arr))
            return '';
        return arr.join(typeof sep === 'string' ? sep : ', ');
    },
    eq: (a, b) => a === b,
};
