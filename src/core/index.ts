/**
 * MCP Prompts Core Module
 * 
 * This file consolidates all core functionality including:
 * - Type definitions
 * - Storage operations
 * - Utility functions
 * - Test utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as assert from 'assert';

// ===========================================================================
// Type Definitions
// ===========================================================================

/**
 * Represents a prompt or template in the system
 */
export interface Prompt {
  /** Unique identifier for the prompt */
  id: string;
  
  /** Display name for the prompt */
  name: string;
  
  /** Optional description */
  description?: string;
  
  /** The actual prompt content */
  content: string;
  
  /** Whether this is a template with variable substitution */
  isTemplate: boolean;
  
  /** List of variable names for templates */
  variables?: string[];
  
  /** Tags for categorization and filtering */
  tags?: string[];
  
  /** ISO timestamp of creation date */
  createdAt: string;
  
  /** ISO timestamp of last update */
  updatedAt: string;
  
  /** Version number for tracking changes */
  version: number;
}

/**
 * Variables for template substitution
 */
export interface TemplateVariables {
  [key: string]: string | number | boolean;
}

/**
 * Options for listing prompts
 */
export interface ListPromptsOptions {
  /** Filter prompts by tag */
  tag?: string;
  
  /** Filter templates only */
  templatesOnly?: boolean;
  
  /** Maximum number of prompts to return */
  limit?: number;
}

/**
 * Result of applying a template
 */
export interface ApplyTemplateResult {
  /** Original template */
  template: Prompt;
  
  /** Applied content with variables substituted */
  content: string;
  
  /** Variables used for substitution */
  variables: TemplateVariables;
}

// ===========================================================================
// Storage Configuration
// ===========================================================================

// Promisify fs functions
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

// Configuration
export const PROMPTS_DIR = path.join(process.cwd(), 'prompts');
export const PROCESSED_DIR = path.join(process.cwd(), 'processed_prompts');

// ===========================================================================
// Utility Functions
// ===========================================================================

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
 * Parse content from various sources to extract prompts.
 * Supports formats like JSON, Markdown, or raw text.
 */
export function parsePromptContent(content: string): Partial<Prompt>[] {
  const prompts: Partial<Prompt>[] = [];
  
  // Try to parse as JSON first
  try {
    const jsonData = JSON.parse(content);
    
    if (jsonData.content) {
      // Single prompt object
      prompts.push(jsonData);
    } else if (Array.isArray(jsonData)) {
      // Array of prompts
      jsonData.forEach(item => {
        if (item.content) {
          prompts.push(item);
        }
      });
    }
  } catch (error) {
    // Not valid JSON, continue with other formats
  }
  
  // If no prompts found from JSON parsing, try regex patterns
  if (prompts.length === 0) {
    // Extract content fields
    const contentRegex = /"content":\s*"([^"]+)"/g;
    const systemRoleRegex = /"role":\s*"system",\s*"content":\s*"([^"]+)"/g;
    
    let match;
    
    // Extract system role content (highest priority)
    while ((match = systemRoleRegex.exec(content)) !== null) {
      const promptContent = match[1].replace(/\\n/g, '\n');
      
      // Skip very short or placeholder content
      if (promptContent.length < 20 || 
          promptContent === "You are a helpful assistant." ||
          promptContent.includes("This is the content of the file") ||
          promptContent.includes("What is the capital of")) {
        continue;
      }
      
      const name = generatePromptName(promptContent);
      prompts.push({
        name,
        id: createSlugFromName(name),
        content: promptContent,
        description: generateDescription(promptContent),
        isTemplate: promptContent.includes('{{') && promptContent.includes('}}')
      });
    }
    
    // Extract regular content fields
    while ((match = contentRegex.exec(content)) !== null) {
      const promptContent = match[1].replace(/\\n/g, '\n');
      
      // Skip very short or placeholder content
      if (promptContent.length < 20 || 
          promptContent === "You are a helpful assistant." ||
          promptContent.includes("This is the content of the file") ||
          promptContent.includes("What is the capital of")) {
        continue;
      }
      
      // Check if this content is already added (to avoid duplicates)
      const isDuplicate = prompts.some(p => p.content === promptContent);
      if (isDuplicate) {
        continue;
      }
      
      const name = generatePromptName(promptContent);
      prompts.push({
        name,
        id: createSlugFromName(name),
        content: promptContent,
        description: generateDescription(promptContent),
        isTemplate: promptContent.includes('{{') && promptContent.includes('}}')
      });
    }
    
    // Check for code blocks in markdown that might contain prompts
    if (content.includes('```') && content.includes('You are')) {
      const codeBlocks = content.match(/```(?:\w+)?\n([\s\S]*?)```/g);
      
      if (codeBlocks) {
        codeBlocks.forEach(block => {
          // Extract content between triple backticks
          const blockContent = block.replace(/```(?:\w+)?\n([\s\S]*?)```/g, '$1');
          
          if (blockContent.includes('You are') && blockContent.length > 50) {
            const name = generatePromptName(blockContent);
            prompts.push({
              name,
              id: createSlugFromName(name),
              content: blockContent,
              description: generateDescription(blockContent),
              isTemplate: blockContent.includes('{{') && blockContent.includes('}}')
            });
          }
        });
      }
    }
  }
  
  // Return unique prompts
  return prompts;
}

/**
 * Generate a name for a prompt based on its content
 */
export function generatePromptName(content: string): string {
  if (content.toLowerCase().startsWith('you are')) {
    // Extract the first sentence to create a name
    const firstLine = content.split('\n')[0];
    const firstSentence = firstLine.split('.')[0];
    
    if (firstSentence.length > 40) {
      return firstSentence.substring(0, 40) + '...';
    }
    return firstSentence;
  }
  
  // For other content types, generate a descriptive name
  const words = content.split(' ').slice(0, 6);
  const name = words.join(' ');
  
  if (name.length > 40) {
    return name.substring(0, 40) + '...';
  }
  return name;
}

/**
 * Generate appropriate tags based on prompt content
 */
export function generateTags(prompt: Partial<Prompt>): string[] {
  const tags: string[] = ['ai'];
  const content = prompt.content?.toLowerCase() || '';
  
  // Check for role-based tags
  if (content.includes('you are a') || content.includes('you are an') || 
      content.includes('assistant') || content.includes('helper')) {
    tags.push('ai-assistant');
  }
  
  // Check for productivity-related tags
  if (content.includes('productivity') || content.includes('workflow') || 
      content.includes('organize') || content.includes('efficiency')) {
    tags.push('productivity');
  }
  
  // Check for programming-related tags
  if (content.includes('code') || content.includes('programming') || 
      content.includes('developer') || content.includes('javascript') || 
      content.includes('python') || content.includes('typescript')) {
    tags.push('coding');
  }
  
  // Check for analysis-related tags
  if (content.includes('analysis') || content.includes('analyze') || 
      content.includes('data') || content.includes('statistics') || 
      content.includes('pattern') || content.includes('insight')) {
    tags.push('analysis');
  }
  
  // Check for template indicators
  if (prompt.isTemplate) {
    tags.push('template');
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

// ===========================================================================
// Storage Operations
// ===========================================================================

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

// ===========================================================================
// Test Utilities
// ===========================================================================

/**
 * Create test prompts for testing functionality
 */
export function createTestPrompts(): { prompt: Prompt, template: Prompt } {
  const now = new Date().toISOString();
  
  const prompt: Prompt = {
    id: 'test-prompt',
    name: 'Test Prompt',
    description: 'A prompt for testing',
    content: 'This is a test prompt content',
    isTemplate: false,
    tags: ['test', 'prompt'],
    createdAt: now,
    updatedAt: now,
    version: 1
  };
  
  const template: Prompt = {
    id: 'test-template',
    name: 'Test Template',
    description: 'A template for testing',
    content: 'This is a test template with {{variable}}',
    isTemplate: true,
    variables: ['variable'],
    tags: ['test', 'template'],
    createdAt: now,
    updatedAt: now,
    version: 1
  };
  
  return { prompt, template };
}

/**
 * Run tests for prompt functionality
 */
export async function runTests(useInMemory = true): Promise<void> {
  console.log('Starting MCP Prompts Server tests');
  
  // Set up test environment
  const testDir = useInMemory ? null : path.join(process.cwd(), 'test-output');
  if (testDir && !fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Use in-memory or file storage
  const testPrompts = new Map<string, Prompt>();
  
  const testStorage = {
    savePrompt: async (prompt: Prompt): Promise<void> => {
      if (useInMemory) {
        testPrompts.set(prompt.id, prompt);
      } else {
        const filePath = path.join(testDir!, `${prompt.id}.json`);
        await promisify(fs.writeFile)(filePath, JSON.stringify(prompt, null, 2));
      }
    },
    loadPrompt: async (id: string): Promise<Prompt | null> => {
      if (useInMemory) {
        return testPrompts.get(id) || null;
      } else {
        try {
          const filePath = path.join(testDir!, `${id}.json`);
          const content = await promisify(fs.readFile)(filePath, 'utf8');
          return JSON.parse(content) as Prompt;
        } catch (error) {
          return null;
        }
      }
    }
  };
  
  const { prompt: testPrompt, template: testTemplate } = createTestPrompts();
  
  try {
    // Test saving and loading a prompt
    await testStorage.savePrompt(testPrompt);
    const loadedPrompt = await testStorage.loadPrompt(testPrompt.id);
    
    assert.strictEqual(loadedPrompt!.id, testPrompt.id);
    assert.strictEqual(loadedPrompt!.name, testPrompt.name);
    assert.strictEqual(loadedPrompt!.content, testPrompt.content);
    
    console.log('✓ Test passed: Save and load prompt');
    
    // Test saving and loading a template
    await testStorage.savePrompt(testTemplate);
    const loadedTemplate = await testStorage.loadPrompt(testTemplate.id);
    
    assert.strictEqual(loadedTemplate!.id, testTemplate.id);
    assert.strictEqual(loadedTemplate!.isTemplate, true);
    assert.deepStrictEqual(loadedTemplate!.variables, testTemplate.variables);
    
    console.log('✓ Test passed: Save and load template');
    
    // Test applying a template
    const appliedContent = applyTemplate(testTemplate, { variable: 'test value' });
    assert.strictEqual(appliedContent, 'This is a test template with test value');
    
    console.log('✓ Test passed: Apply template');
    
    // Test parsing raw content
    const rawContent = 'You are a brilliant coding assistant that helps with debugging.';
    const parsedPrompts = parsePromptContent(rawContent);
    
    assert.ok(parsedPrompts.length > 0, 'Should extract at least one prompt');
    assert.ok(parsedPrompts[0].content?.includes('brilliant coding assistant'), 
        'Should preserve original content');
    
    console.log('✓ Test passed: Parse prompt content');
    
    // Test generating tags
    const tags = generateTags({ 
      content: 'You are a coding assistant that helps with programming tasks',
      isTemplate: false
    });
    
    assert.ok(tags.includes('ai'), 'Should include the ai tag');
    assert.ok(tags.includes('coding') || tags.includes('programming'), 
        'Should detect coding-related content');
    
    console.log('✓ Test passed: Generate tags');
    
    // Test handling non-existent prompt
    const nonExistentPrompt = await testStorage.loadPrompt('non-existent');
    assert.strictEqual(nonExistentPrompt, null);
    
    console.log('✓ Test passed: Handle non-existent prompt');
    
    console.log('All tests passed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    // Clean up test environment
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

// Export the prompt management module
export * from './prompt-management'; 