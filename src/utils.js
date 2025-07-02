"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultTemplatingEngine = exports.HandlebarsTemplatingEngine = exports.templateHelpers = void 0;
exports.getRedisClient = getRedisClient;
exports.closeRedisClient = closeRedisClient;
exports.applyTemplate = applyTemplate;
exports.jsonFriendlyErrorReplacer = jsonFriendlyErrorReplacer;
const ioredis_1 = require("ioredis");
const handlebars_1 = __importDefault(require("handlebars"));
const config_js_1 = require("./config.js");
let redisClient = null;
/**
 * Returns a singleton Redis client, initialized from config.
 */
function getRedisClient() {
    if (!config_js_1.config.redis || !config_js_1.config.redis.host)
        return null;
    if (!redisClient) {
        redisClient = new ioredis_1.Redis({
            db: config_js_1.config.redis.db,
            host: config_js_1.config.redis.host,
            lazyConnect: true,
            password: config_js_1.config.redis.password,
            port: config_js_1.config.redis.port,
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
async function closeRedisClient() {
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
function applyTemplate(content, variables) {
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
function jsonFriendlyErrorReplacer(_key, value) {
    if (value instanceof Error) {
        return {
            message: value.message,
            name: value.name,
            stack: value.stack,
        };
    }
    return value;
}
exports.templateHelpers = {
    /** Converts a string to uppercase. */
    toUpperCase: (str) => (typeof str === 'string' ? str.toUpperCase() : ''),
    /** Converts a string to lowercase. */
    toLowerCase: (str) => (typeof str === 'string' ? str.toLowerCase() : ''),
    /** Stringifies a value as pretty JSON. */
    jsonStringify: (context) => JSON.stringify(context, jsonFriendlyErrorReplacer, 2),
    /** Joins an array with a separator. */
    join: (arr, sep) => {
        if (!Array.isArray(arr))
            return '';
        return arr.join(typeof sep === 'string' ? sep : ', ');
    },
    /** Checks if two values are equal. */
    eq: (a, b) => a === b,
    /** Logical NOT. */
    not: (v) => !v,
    /** Logical AND. */
    and: (...args) => args.slice(0, -1).every(Boolean),
    /** Logical OR. */
    or: (...args) => args.slice(0, -1).some(Boolean),
    /** Gets the length of an array or string. */
    length: (v) => (Array.isArray(v) || typeof v === 'string' ? v.length : 0),
    /** Capitalizes the first letter of a string. */
    capitalize: (str) => typeof str === 'string' && str.length > 0 ? str[0].toUpperCase() + str.slice(1) : '',
    /** Formats a date string or Date object as YYYY-MM-DD. */
    formatDate: (date) => {
        const d = typeof date === 'string' ? new Date(date) : date instanceof Date ? date : null;
        if (!d || isNaN(d.getTime()))
            return '';
        return d.toISOString().slice(0, 10);
    },
    /** Adds two numbers. */
    add: (a, b) => Number(a) + Number(b),
    /** Subtracts b from a. */
    subtract: (a, b) => Number(a) - Number(b),
    /** Multiplies two numbers. */
    multiply: (a, b) => Number(a) * Number(b),
    /** Divides a by b. */
    divide: (a, b) => Number(b) !== 0 ? Number(a) / Number(b) : '',
};
class HandlebarsTemplatingEngine {
    render(template, variables) {
        const compiled = handlebars_1.default.compile(template);
        return compiled(variables);
    }
}
exports.HandlebarsTemplatingEngine = HandlebarsTemplatingEngine;
exports.defaultTemplatingEngine = new HandlebarsTemplatingEngine();
