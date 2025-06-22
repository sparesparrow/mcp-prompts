import { Redis } from 'ioredis';
import Handlebars from 'handlebars';
/**
 * Returns a singleton Redis client, initialized from config.
 */
export declare function getRedisClient(): Redis | null;
/**
 * Closes the singleton Redis client connection.
 */
export declare function closeRedisClient(): Promise<void>;
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
export declare function applyTemplate(content: string, variables: Record<string, string>): string;
/**
 * A replacer function for JSON.stringify to correctly serialize Error objects.
 * @param _key The key being replaced.
 * @param value The value to replace.
 * @returns A serializable representation of the Error object, or the original value.
 */
export declare function jsonFriendlyErrorReplacer(_key: string, value: unknown): unknown;
export declare const templateHelpers: Record<string, Handlebars.HelperDelegate>;
