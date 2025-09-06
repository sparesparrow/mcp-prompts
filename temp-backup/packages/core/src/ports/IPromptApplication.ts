import type { Prompt, ListPromptsOptions, TemplateVariables, ApplyTemplateResult } from '../entities';

/**
 * Primary port: IPromptApplication
 * Defines the API for all prompt management use cases
 */
export interface IPromptApplication {
  /**
   * Get a prompt by ID and optional version
   */
  getPrompt(id: string, version?: number): Promise<Prompt | null>;

  /**
   * Add a new prompt
   */
  addPrompt(data: Partial<Prompt>): Promise<Prompt>;

  /**
   * Update an existing prompt
   */
  updatePrompt(id: string, version: number, data: Partial<Prompt>): Promise<Prompt>;

  /**
   * List prompts with optional filtering and pagination
   */
  listPrompts(options?: ListPromptsOptions, allVersions?: boolean): Promise<Prompt[]>;

  /**
   * Delete a prompt or specific version
   */
  deletePrompt(id: string, version?: number): Promise<boolean>;

  /**
   * List all versions for a prompt ID
   */
  listPromptVersions(id: string): Promise<number[]>;

  /**
   * Apply variables to a template prompt
   */
  applyTemplate(
    id: string,
    variables: TemplateVariables,
    version?: number,
  ): Promise<ApplyTemplateResult>;

  /**
   * Validate a prompt
   */
  validatePrompt(prompt: Prompt): Promise<boolean>;

  /**
   * Bulk create prompts
   */
  createPromptsBulk(prompts: Partial<Prompt>[]): Promise<Array<{ success: boolean; id?: string; error?: string }>>;

  /**
   * Bulk delete prompts
   */
  deletePromptsBulk(ids: string[]): Promise<Array<{ success: boolean; id: string; error?: string }>>;

  /**
   * Search prompts by text
   */
  searchPrompts(query: string, options?: ListPromptsOptions): Promise<Prompt[]>;

  /**
   * Get prompt statistics
   */
  getPromptStats(): Promise<{
    total: number;
    templates: number;
    categories: Record<string, number>;
    tags: Record<string, number>;
  }>;
}
