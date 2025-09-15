import { Redis } from 'ioredis';
import Handlebars from 'handlebars';
import type { ITemplatingEngine } from './interfaces.js';

import { config } from './config.js';

let redisClient: Redis | null = null;

/**
 * Returns a singleton Redis client, initialized from config.
 */
export function getRedisClient(): Redis | null {
  if (!config.redis || !config.redis.host) return null;
  if (!redisClient) {
    redisClient = new Redis({
      db: config.redis.db,
      host: config.redis.host,
      lazyConnect: true,
      password: config.redis.password,
      port: config.redis.port,
    });
    redisClient.on('error', (err: Error) => {
      console.error('[Redis] Connection error:', err);
    });
  }
  return redisClient;
}

/**
 * Closes the singleton Redis client connection.
 */
export async function closeRedisClient(): Promise<void> {
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
export function applyTemplate(content: string, variables: Record<string, string>): string {
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
export function jsonFriendlyErrorReplacer(_key: string, value: unknown) {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }
  return value;
}

export const templateHelpers: Record<string, Handlebars.HelperDelegate> = {
  /** Converts a string to uppercase. */
  toUpperCase: (str: unknown) => (typeof str === 'string' ? str.toUpperCase() : ''),
  /** Converts a string to lowercase. */
  toLowerCase: (str: unknown) => (typeof str === 'string' ? str.toLowerCase() : ''),
  /** Stringifies a value as pretty JSON. */
  jsonStringify: (context: any) => JSON.stringify(context, jsonFriendlyErrorReplacer, 2),
  /** Joins an array with a separator. */
  join: (arr: unknown, sep: unknown) => {
    if (!Array.isArray(arr)) return '';
    return arr.join(typeof sep === 'string' ? sep : ', ');
  },
  /** Checks if two values are equal. */
  eq: (a: unknown, b: unknown) => a === b,
  /** Logical NOT. */
  not: (v: unknown) => !v,
  /** Logical AND. */
  and: (...args: unknown[]) => args.slice(0, -1).every(Boolean),
  /** Logical OR. */
  or: (...args: unknown[]) => args.slice(0, -1).some(Boolean),
  /** Gets the length of an array or string. */
  length: (v: unknown) => (Array.isArray(v) || typeof v === 'string' ? v.length : 0),
  /** Capitalizes the first letter of a string. */
  capitalize: (str: unknown) =>
    typeof str === 'string' && str.length > 0 ? str[0].toUpperCase() + str.slice(1) : '',
  /** Formats a date string or Date object as YYYY-MM-DD. */
  formatDate: (date: unknown) => {
    const d = typeof date === 'string' ? new Date(date) : date instanceof Date ? date : null;
    if (!d || isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  },
  /** Adds two numbers. */
  add: (a: unknown, b: unknown) => Number(a) + Number(b),
  /** Subtracts b from a. */
  subtract: (a: unknown, b: unknown) => Number(a) - Number(b),
  /** Multiplies two numbers. */
  multiply: (a: unknown, b: unknown) => Number(a) * Number(b),
  /** Divides a by b. */
  divide: (a: unknown, b: unknown) => Number(b) !== 0 ? Number(a) / Number(b) : '',
};

export class HandlebarsTemplatingEngine implements ITemplatingEngine {
  render(template: string, variables: Record<string, string>): string {
    const compiled = Handlebars.compile(template);
    return compiled(variables);
  }
}

export const defaultTemplatingEngine = new HandlebarsTemplatingEngine();
