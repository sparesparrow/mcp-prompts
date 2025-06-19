import type { Prompt, StorageAdapter } from '../interfaces.js';

/**
 * A list of default prompts to be loaded into storage if the store is empty.
 */
export const DEFAULT_PROMPTS: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'version'>[] = [
  {
    content: `You are a development assistant helping with {{project_type}} development using {{language}}.

Role:
- You provide clear, concise code examples with explanations
- You suggest best practices and patterns
- You help debug issues with the codebase

The current project is {{project_name}} which aims to {{project_goal}}.

When providing code examples:
1. Use consistent style and formatting
2. Include comments for complex sections
3. Follow {{language}} best practices
4. Consider performance implications

Technical context:
{{technical_context}}`,
    description: 'A template for creating system prompts for development assistance',
    isTemplate: true,
    name: 'Development System Prompt',
    tags: ['development', 'system', 'template'],
    variables: ['project_type', 'language', 'project_name', 'project_goal', 'technical_context'],
  },
  {
    content:
      'Please create a prioritized task list based on the following requirements:\n\n{{requirements}}',
    description: 'A basic prompt to help organize and prioritize tasks',
    isTemplate: true,
    name: 'Task List Helper',
    tags: ['productivity', 'planning'],
    variables: ['requirements'],
  },
];

/**
 * Initializes the storage with default prompts if it is currently empty.
 * @param storageAdapter - The storage adapter to use for saving prompts.
 */
export async function initializeDefaultPrompts(storageAdapter: StorageAdapter) {
  try {
    const existingPrompts = await storageAdapter.listPrompts();
    if (existingPrompts.length === 0) {
      console.log('Initializing storage with default prompts...');
      for (const promptData of DEFAULT_PROMPTS) {
        // This is a bit of a hack, the adapter should handle this
        const newPrompt: Prompt = {
          id: promptData.name.toLowerCase().replace(/\s+/g, '-'),
          ...promptData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        };
        await storageAdapter.savePrompt(newPrompt);
      }
      console.log(`Added ${DEFAULT_PROMPTS.length} default prompts.`);
    } else {
      console.log('Skipping default prompt initialization, prompts already exist.');
    }
  } catch (error) {
    console.error('Error initializing default prompts:', error);
  }
}
