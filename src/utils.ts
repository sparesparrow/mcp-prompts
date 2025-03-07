/**
 * Utility Functions for MCP Prompts Server
 * 
 * This file contains helper functions used throughout the application.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { v4 as uuidv4 } from 'uuid';
import { Prompt, TemplateVariables, ApplyTemplateResult, ListPromptsOptions, ValidationResult } from './types';

// Constants
export const PROMPTS_DIR = path.join(process.cwd(), 'prompts');

// Promisify fs functions
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
const readdir = util.promisify(fs.readdir);

/**
 * Apply template variables to a prompt
 * @param prompt The template prompt
 * @param variables Variables to apply to the template
 * @returns The result of applying the template
 */
export function applyTemplate(prompt: Prompt, variables: TemplateVariables): ApplyTemplateResult {
  if (!prompt.isTemplate) {
    return {
      content: prompt.content,
      originalPrompt: prompt,
      appliedVariables: {}
    };
  }
  
  // Extract all variables from the template
  const templateVariables = extractVariables(prompt.content);
  const missingVariables: string[] = [];
  
  // Identify missing variables
  for (const variable of templateVariables) {
    if (!variables[variable]) {
      missingVariables.push(variable);
    }
  }
  
  // Apply the variables
  let content = prompt.content;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    content = content.replace(regex, String(value));
  }
  
  return {
    content,
    originalPrompt: prompt,
    appliedVariables: variables,
    missingVariables: missingVariables.length > 0 ? missingVariables : undefined
  };
}

/**
 * Validate a prompt object
 * @param prompt The prompt to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validatePrompt(prompt: Partial<Prompt>): ValidationResult {
  if (!prompt) {
    return { valid: false, error: 'Prompt is required' };
  }
  
  if (!prompt.content || prompt.content.trim().length === 0) {
    return { valid: false, error: 'Content is required' };
  }
  
  if (prompt.isTemplate && (!prompt.variables || prompt.variables.length === 0)) {
    // Auto-extract variables if it's marked as a template but no variables are provided
    const extractedVariables = extractVariables(prompt.content);
    if (extractedVariables.length === 0) {
      return { valid: false, error: 'Template prompt must contain variables' };
    }
    prompt.variables = extractedVariables;
  }
  
  return { valid: true };
}

/**
 * Extract variables from template content
 * @param content The template content
 * @returns Array of variable names
 */
export function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
  return matches
    .map(match => match.replace(/\{\{|\}\}/g, '').trim())
    .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
}

/**
 * Create a slug from a prompt name
 * @param name The name to convert to a slug
 * @returns URL-friendly slug
 */
export function createSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Remove consecutive hyphens
}

/**
 * Generate a description from prompt content
 * @param content The prompt content
 * @returns Generated description
 */
export function generateDescription(content: string): string {
  // Take the first 150 characters or the first line, whichever is shorter
  const firstLine = content.split('\n')[0].trim();
  const shortText = content.substring(0, 150).trim();
  
  const description = firstLine.length < shortText.length ? firstLine : shortText;
  return description + (description.length < content.length ? '...' : '');
}

/**
 * Generate a name from prompt content
 * @param content The prompt content
 * @returns Generated name
 */
export function generatePromptName(content: string): string {
  // Use the first line or first few words
  const firstLine = content.split('\n')[0].trim();
  const words = firstLine.split(/\s+/);
  const shortName = words.slice(0, 6).join(' ');
  
  return shortName.length > 50 ? shortName.substring(0, 47) + '...' : shortName;
}

/**
 * Ensure the prompts directory exists
 * @returns The path to the prompts directory
 */
export function ensurePromptsDir(): string {
  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  }
  return PROMPTS_DIR;
}

/**
 * Save a prompt to the filesystem
 * @param prompt The prompt to save
 * @returns Promise that resolves when the prompt is saved
 */
export async function savePrompt(prompt: Prompt): Promise<void> {
  ensurePromptsDir();
  
  // Generate an ID if one doesn't exist
  if (!prompt.id) {
    prompt.id = uuidv4();
  }
  
  const promptPath = path.join(PROMPTS_DIR, `${prompt.id}.json`);
  await writeFile(promptPath, JSON.stringify(prompt, null, 2));
}

/**
 * Load a prompt from the filesystem
 * @param id The ID of the prompt to load
 * @returns Promise that resolves with the prompt or null if not found
 */
export async function loadPrompt(id: string): Promise<Prompt | null> {
  try {
    const promptPath = path.join(PROMPTS_DIR, `${id}.json`);
    const content = await readFile(promptPath, 'utf8');
    return JSON.parse(content) as Prompt;
  } catch (error) {
    console.log(`Error loading prompt ${id}:`, error);
    return null;
  }
}

/**
 * Delete a prompt from the filesystem
 * @param id The ID of the prompt to delete
 * @returns Promise that resolves when the prompt is deleted
 */
export async function deletePrompt(id: string): Promise<void> {
  try {
    const promptPath = path.join(PROMPTS_DIR, `${id}.json`);
    await unlink(promptPath);
  } catch (error) {
    console.log(`Error deleting prompt ${id}:`, error);
    throw error;
  }
}

/**
 * List prompts with optional filtering and sorting
 * @param options Options for filtering and pagination
 * @returns Promise that resolves with an array of prompts
 */
export async function listPrompts(options: ListPromptsOptions = {}): Promise<Prompt[]> {
  const { 
    tag, 
    isTemplate, 
    search, 
    sort = 'name', 
    order = 'asc', 
    limit, 
    offset = 0,
    templatesOnly
  } = options as {
    tag?: string;
    isTemplate?: boolean;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
    templatesOnly?: boolean;
  };
  
  // Convert templatesOnly to isTemplate for backward compatibility
  const effectiveIsTemplate = isTemplate !== undefined ? isTemplate : 
                             templatesOnly !== undefined ? templatesOnly : 
                             undefined;
  
  ensurePromptsDir();
  
  // Read all prompt files
  const files = await readdir(PROMPTS_DIR);
  const jsonFiles = files.filter(file => file.endsWith('.json'));
  
  const promptsPromises = jsonFiles.map(async file => {
    try {
      const content = await readFile(path.join(PROMPTS_DIR, file), 'utf8');
      return JSON.parse(content) as Prompt;
    } catch (error) {
      console.log(`Error reading prompt file ${file}:`, error);
      return null;
    }
  });
  
  let prompts = (await Promise.all(promptsPromises)).filter(Boolean) as Prompt[];
  
  // Apply filters
  if (tag) {
    prompts = prompts.filter(prompt => prompt.tags && prompt.tags.includes(tag));
  }
  
  if (effectiveIsTemplate !== undefined) {
    prompts = prompts.filter(prompt => !!prompt.isTemplate === effectiveIsTemplate);
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    prompts = prompts.filter(prompt => 
      prompt.name.toLowerCase().includes(searchLower) ||
      (prompt.description && prompt.description.toLowerCase().includes(searchLower)) ||
      prompt.content.toLowerCase().includes(searchLower)
    );
  }
  
  // Sort prompts
  prompts.sort((a, b) => {
    const aValue = a[sort as keyof Prompt] || '';
    const bValue = b[sort as keyof Prompt] || '';
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return order === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return 0;
  });
  
  // Apply pagination
  if (limit) {
    prompts = prompts.slice(offset, offset + limit);
  } else if (offset > 0) {
    prompts = prompts.slice(offset);
  }
  
  return prompts;
}

/**
 * Simple HTML sanitization to prevent XSS
 * @param html The HTML to sanitize
 * @returns Sanitized HTML
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // Simple sanitization - replace HTML tags with escaped versions
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a slug from a string
 * @param str The string to slugify
 * @returns A URL-friendly slug
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Format a date string in a human-readable format
 * @param date The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Truncate a string to a maximum length with ellipsis
 * @param str The string to truncate
 * @param maxLength Maximum length before truncation
 * @returns Truncated string
 */
export function truncate(str: string, maxLength: number = 100): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Safely parse JSON with error handling
 * @param json The JSON string to parse
 * @param fallback Default value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return fallback;
  }
}

/**
 * Delay execution for a specified time
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
} 