/**
 * Utility functions for the MCP Prompts Server
 */

import { TemplateVariable } from './types.js';

/**
 * Convert a string to a slug
 * @param str String to convert
 * @returns Slugified string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract variables from a template string
 * Variables are in the format {{variableName}}
 * @param template Template string
 * @returns Array of variable names
 */
export function extractVariables(template: string): string[] {
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
}

/**
 * Generate a random ID
 * @param length Length of the ID
 * @returns Random ID
 */
export function generateId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Deep clone an object
 * @param obj Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Format a date as an ISO string
 * @param date Date to format
 * @returns ISO string
 */
export function formatDate(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Validate that a string is not empty
 * @param str String to validate
 * @param name Name of the field
 * @throws Error if the string is empty
 */
export function validateString(str: string | undefined, name: string): void {
  if (!str || str.trim() === '') {
    throw new Error(`${name} is required`);
  }
}

/**
 * Validate if a prompt object has the required fields
 * @param prompt Prompt to validate
 * @returns True if valid, false otherwise
 */
export function validatePrompt(prompt: any): boolean {
  return (
    prompt &&
    typeof prompt.id === 'string' &&
    typeof prompt.name === 'string' &&
    typeof prompt.content === 'string' &&
    typeof prompt.isTemplate === 'boolean'
  );
} 