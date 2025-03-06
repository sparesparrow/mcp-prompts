/**
 * Storage and utility module for prompts
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Prompt, ListPromptsOptions, TemplateVariables } from '../types';

// Promisify fs functions
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

// Configuration
const PROMPTS_DIR = path.join(process.cwd(), 'prompts');

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

/**
 * Ensure the prompts directory exists
 */
export async function ensurePromptsDir(): Promise<void> {
  try {
    await stat(PROMPTS_DIR);
  } catch (error) {
    await mkdir(PROMPTS_DIR, { recursive: true });
  }
}

/**
 * Save a prompt to storage
 */
export async function savePrompt(prompt: Prompt): Promise<void> {
  await ensurePromptsDir();
  
  // Save JSON version
  const jsonPath = path.join(PROMPTS_DIR, `${prompt.id}.json`);
  await writeFile(jsonPath, JSON.stringify(prompt, null, 2));
  
  // Save Markdown version
  const mdContent = `# ${prompt.name}

${prompt.description || ''}

## Tags

${prompt.tags ? prompt.tags.map(tag => `- ${tag}`).join('\n') : ''}

## Content

\`\`\`
${prompt.content}
\`\`\`

## Metadata

- ID: ${prompt.id}
- Version: ${prompt.version}
- Created: ${prompt.createdAt}
- Updated: ${prompt.updatedAt}
`;
  
  const mdPath = path.join(PROMPTS_DIR, `${prompt.id}.md`);
  await writeFile(mdPath, mdContent);
}

/**
 * Load a prompt from storage
 */
export async function loadPrompt(id: string): Promise<Prompt | null> {
  try {
    const filePath = path.join(PROMPTS_DIR, `${id}.json`);
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as Prompt;
  } catch (error) {
    return null;
  }
}

/**
 * Delete a prompt from storage
 */
export async function deletePrompt(id: string): Promise<boolean> {
  try {
    const jsonPath = path.join(PROMPTS_DIR, `${id}.json`);
    const mdPath = path.join(PROMPTS_DIR, `${id}.md`);
    
    fs.unlinkSync(jsonPath);
    if (fs.existsSync(mdPath)) {
      fs.unlinkSync(mdPath);
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * List all prompts, with optional filtering
 */
export async function listPrompts(options: ListPromptsOptions = {}): Promise<Prompt[]> {
  await ensurePromptsDir();
  
  const prompts: Prompt[] = [];
  
  // Helper function to process a directory
  async function processDirectory(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively process subdirectories
          await processDirectory(fullPath);
        } else if (entry.name.endsWith('.json')) {
          try {
            const content = await readFile(fullPath, 'utf8');
            const prompt = JSON.parse(content) as Prompt;
            
            // Apply filters if specified
            if (options.tag && (!prompt.tags || !prompt.tags.includes(options.tag))) {
              continue;
            }
            
            if (options.templatesOnly && !prompt.isTemplate) {
              continue;
            }
            
            prompts.push(prompt);
          } catch (error) {
            console.error(`Error processing ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }
  }
  
  await processDirectory(PROMPTS_DIR);
  
  // Apply limit if specified
  if (options.limit && options.limit > 0) {
    return prompts.slice(0, options.limit);
  }
  
  return prompts;
} 