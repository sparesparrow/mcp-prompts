/**
 * Utility functions for the MCP Prompts server
 */

/**
 * Convert a string to a URL-friendly slug
 * @param str String to slugify
 * @returns Slugified string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Extract variables from a prompt template
 * Variables are defined as {{variableName}}
 * @param content Template content
 * @returns Array of unique variable names
 */
export function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
  return matches
    .map(match => match.replace(/\{\{|\}\}/g, '').trim())
    .filter((value, index, self) => self.indexOf(value) === index);
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

/**
 * Generate a random ID for a prompt
 * @returns Random ID string
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
} 