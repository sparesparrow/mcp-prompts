/**
 * Utility functions for working with prompts
 */

import { Prompt, TemplateVariables } from '../types';

/**
 * Apply variable substitution to a template
 */
export function applyTemplate(template: Prompt, variables: TemplateVariables): string {
  if (!template.isTemplate) {
    return template.content;
  }
  
  let content = template.content;
  
  // Perform substitution for each variable
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    content = content.replace(regex, String(value));
  }
  
  return content;
}

/**
 * Validate a prompt object
 */
export function validatePrompt(prompt: any): Prompt {
  // Ensure required fields
  if (!prompt.id) throw new Error('Prompt must have an id');
  if (!prompt.name) throw new Error('Prompt must have a name');
  if (!prompt.content) throw new Error('Prompt must have content');
  
  // Set default values for optional fields
  const validatedPrompt: Prompt = {
    id: prompt.id,
    name: prompt.name,
    description: prompt.description || prompt.name,
    content: prompt.content,
    isTemplate: prompt.isTemplate || false,
    tags: prompt.tags || [],
    createdAt: prompt.createdAt || new Date().toISOString(),
    updatedAt: prompt.updatedAt || new Date().toISOString(),
    version: prompt.version || 1
  };
  
  // Add variables array if it's a template
  if (validatedPrompt.isTemplate) {
    validatedPrompt.variables = prompt.variables || extractVariables(prompt.content);
  }
  
  return validatedPrompt;
}

/**
 * Extract variables from template content
 */
export function extractVariables(content: string): string[] {
  const variableRegex = /{{([^{}]+)}}/g;
  const variables = new Set<string>();
  
  let match;
  while ((match = variableRegex.exec(content)) !== null) {
    variables.add(match[1].trim());
  }
  
  return Array.from(variables);
}

/**
 * Create a slug/ID from a prompt name
 */
export function createSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Generate a standardized description
 */
export function generateDescription(content: string): string {
  // Extract first sentence or up to 100 chars
  let desc = content.split('.')[0];
  if (desc.length > 100) {
    desc = desc.substring(0, 100) + '...';
  }
  return desc;
} 