/**
 * Consolidated Adapters Module
 * Contains all storage adapters in a single file
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import pg from 'pg';
import type { pino } from 'pino';

import {
  type ListPromptsOptions,
  type McpConfig,
  type Prompt,
  type PromptSequence,
  type StorageAdapter,
  type WorkflowExecutionState,
} from './interfaces.js';
import { ValidationError, validatePrompt } from './validation.js';

export type { StorageAdapter };

/**
 * FileAdapter Implementation
 * Stores prompts as individual JSON files in a directory
 */
export class FileAdapter implements StorageAdapter {
  private promptsDir: string;
  private sequencesDir: string;
  private workflowStatesDir: string;
  private connected = false;
  private prompts: Map<string, Prompt> = new Map();
  private useCatalog: boolean;
  private catalog: any;

  public constructor(promptsDir: string, useCatalog = false) {
    this.promptsDir = promptsDir;
    this.sequencesDir = path.join(promptsDir, 'sequences');
    this.workflowStatesDir = path.join(promptsDir, 'workflow-states');
    this.useCatalog = useCatalog;
  }

  public async connect(): Promise<void> {
    try {
      if (!this.useCatalog) {
        await fs.mkdir(this.promptsDir, { recursive: true });
        await fs.mkdir(this.sequencesDir, { recursive: true });
        await fs.mkdir(this.workflowStatesDir, { recursive: true });
        console.error(`File storage connected: ${this.promptsDir}`);

        // Validate existing prompts on startup
        const files = await fs.readdir(this.promptsDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(this.promptsDir, file);
            try {
              const content = await fs.readFile(filePath, 'utf-8');
              const prompt = JSON.parse(content);
              validatePrompt(prompt, true);
            } catch (error: unknown) {
              if (error instanceof ValidationError) {
                console.warn(`Validation failed for ${file}: ${error.message}`);
              } else {
                console.error(`Error reading or parsing ${file}:`, error);
              }
            }
          }
        }
      } else {
        this.catalog = await import('@sparesparrow/mcp-prompts-catalog');
        console.error('Catalog storage connected');
      }
      this.connected = true;
    } catch (error: unknown) {
      console.error('Error connecting to file storage:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to connect to file storage: ${error.message}`);
      }
      throw new Error(`Failed to connect to file storage`);
    }
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
    console.error('File storage disconnected');
  }

  public async savePrompt(prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    validatePrompt(prompt, true);
    const finalPath = path.join(this.promptsDir, `${prompt.id}.json`);
    const tempPath = `${finalPath}.tmp`;

    try {
      await fs.writeFile(tempPath, JSON.stringify(prompt, null, 2));
      await fs.rename(tempPath, finalPath);
      return prompt;
    } catch (error: unknown) {
      // Clean up the temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError: unknown) {
        // Ignore errors on cleanup, the original error is more important
      }
      console.error('Error saving prompt to file:', error);
      throw error;
    }
  }

  public async getPrompt(id: string): Promise<Prompt | null> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    if (this.useCatalog) {
      // Search all categories for the prompt
      const categories = this.catalog.getCategories();
      for (const category of categories) {
        const prompts = this.catalog.listPrompts(category);
        if (prompts.includes(id)) {
          const prompt = this.catalog.loadPrompt(id, category);
          try {
            validatePrompt(prompt, true);
            return prompt;
          } catch (error: unknown) {
            if (error instanceof ValidationError) {
              console.error(
                `Validation error for catalog prompt ${id} in category ${category}:`,
                error.message,
              );
            } else {
              console.error(`Error loading catalog prompt ${id} in category ${category}:`, error);
            }
            return null;
          }
        }
      }
      return null;
    }

    try {
      const content = await fs.readFile(path.join(this.promptsDir, `${id}.json`), 'utf-8');
      const prompt = JSON.parse(content);
      validatePrompt(prompt, true);
      return prompt;
    } catch (error: unknown) {
      if (error instanceof ValidationError) {
        console.error(`Validation error for prompt ${id}:`, error.message);
        return null;
      }
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      console.error(`Error getting prompt ${id} from file:`, error);
      throw error;
    }
  }

  public async updatePrompt(id: string, prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    validatePrompt(prompt, true);
    const finalPath = path.join(this.promptsDir, `${id}.json`);
    const tempPath = `${finalPath}.tmp`;
    try {
      const updatedPrompt = { ...prompt, id, updatedAt: new Date().toISOString() };
      validatePrompt(updatedPrompt, true);
      await fs.writeFile(tempPath, JSON.stringify(updatedPrompt, null, 2));
      await fs.rename(tempPath, finalPath);
      return updatedPrompt;
    } catch (error: unknown) {
      // Clean up the temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError: unknown) {
        // Ignore errors on cleanup, the original error is more important
      }
      console.error('Error updating prompt to file:', error);
      throw error;
    }
  }

  public async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }
    const filePath = path.join(this.promptsDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Error deleting prompt ${id} from file:`, error);
        throw error;
      }
    }
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    try {
      const content = await fs.readFile(path.join(this.sequencesDir, `${id}.json`), 'utf-8');
      return JSON.parse(content);
    } catch (error: unknown) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      console.error(`Error getting sequence ${id} from file:`, error);
      throw error;
    }
  }

  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    const finalPath = path.join(this.sequencesDir, `${sequence.id}.json`);
    const tempPath = `${finalPath}.tmp`;

    try {
      await fs.writeFile(tempPath, JSON.stringify(sequence, null, 2));
      await fs.rename(tempPath, finalPath);
      return sequence;
    } catch (error: unknown) {
      // Clean up the temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError: unknown) {
        // Ignore errors on cleanup, the original error is more important
      }
      console.error('Error saving sequence to file:', error);
      throw error;
    }
  }

  public async deleteSequence(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    try {
      await fs.unlink(path.join(this.sequencesDir, `${id}.json`));
    } catch (error: unknown) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Error deleting sequence ${id} from file:`, error);
        throw error;
      }
    }
  }

  public async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    if (this.useCatalog) {
      const categories = this.catalog.getCategories();
      const prompts: Prompt[] = [];
      for (const category of categories) {
        for (const name of this.catalog.listPrompts(category)) {
          const prompt = this.catalog.loadPrompt(name, category);
          try {
            validatePrompt(prompt, true);
            prompts.push(prompt);
          } catch (error: unknown) {
            if (error instanceof ValidationError) {
              console.error(
                `Validation error for catalog prompt ${name} in category ${category}:`,
                error.message,
              );
            } else {
              console.error(`Error loading catalog prompt ${name} in category ${category}:`, error);
            }
          }
        }
      }
      return this.filterPrompts(prompts, options);
    }

    try {
      const files = await fs.readdir(this.promptsDir);
      const prompts: Prompt[] = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(this.promptsDir, file), 'utf-8');
            const prompt = JSON.parse(content);
            validatePrompt(prompt, true);
            prompts.push(prompt);
          } catch (error: unknown) {
            if (error instanceof ValidationError) {
              console.error(`Validation error for prompt file ${file}:`, error.message);
            } else {
              console.error(`Error reading prompt file ${file}:`, error);
            }
          }
        }
      }
      return this.filterPrompts(prompts, options);
    } catch (error: unknown) {
      console.error('Error listing prompts from file:', error);
      throw error;
    }
  }

  private filterPrompts(prompts: Prompt[], options?: ListPromptsOptions): Prompt[] {
    if (!options) {
      return prompts;
    }

    let filtered = prompts;

    if (options.isTemplate !== undefined) {
      filtered = filtered.filter(p => p.isTemplate === options.isTemplate);
    }

    if (options.category) {
      filtered = filtered.filter(p => p.category === options.category);
    }

    if (options.tags && options.tags.length > 0) {
      const lowerCaseTags = options.tags.map(t => t.toLowerCase());
      filtered = filtered.filter(p => {
        if (!p.tags) return false;
        const lowerCasePromptTags = p.tags.map(t => t.toLowerCase());
        return lowerCaseTags.every(t => lowerCasePromptTags.includes(t));
      });
    }

    return filtered;
  }

  public async getAllPrompts(): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }
    return Array.from(this.prompts.values());
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await fs.access(this.promptsDir);
      return true;
    } catch {
      return false;
    }
  }

  private generateId(name: string): string {
    // Simple slug-like ID for MDC
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    const filePath = path.join(this.workflowStatesDir, `${state.executionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(state, null, 2));
  }

  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    const filePath = path.join(this.workflowStatesDir, `${executionId}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as WorkflowExecutionState;
    } catch (error: unknown) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  public async listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]> {
    const states: WorkflowExecutionState[] = [];
    try {
      const files = await fs.readdir(this.workflowStatesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.workflowStatesDir, file), 'utf-8');
          const state = JSON.parse(content) as WorkflowExecutionState;
          if (state.workflowId === workflowId) {
            states.push(state);
          }
        }
      }
    } catch (error) {
      // Ignore if directory doesn't exist
      if (error instanceof Error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    return states;
  }
}

/**
 * MemoryAdapter Implementation
 * Stores prompts in memory (volatile storage)
 */
export class MemoryAdapter implements StorageAdapter {
  private prompts: Map<string, Prompt> = new Map();
  private sequences: Map<string, PromptSequence> = new Map();
  private workflowStates: Map<string, WorkflowExecutionState> = new Map();
  private connected = false;

  public async connect(): Promise<void> {
    this.connected = true;
    console.log('Memory storage connected');
    this.prompts.clear();
    this.sequences.clear();
  }

  public async disconnect(): Promise<void> {
    this.prompts.clear();
    this.sequences.clear();
    this.connected = false;
    console.log('Memory storage disconnected');
  }

  public async savePrompt(prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    validatePrompt(prompt, true);
    this.prompts.set(prompt.id, prompt);
    return prompt;
  }

  public async getPrompt(id: string): Promise<Prompt | null> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    return this.prompts.get(id) || null;
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    return this.sequences.get(id) || null;
  }

  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    this.sequences.set(sequence.id, sequence);
    return sequence;
  }

  public async deleteSequence(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    this.sequences.delete(id);
  }

  public async updatePrompt(id: string, prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    validatePrompt(prompt, true);
    this.prompts.set(id, prompt);
    return prompt;
  }

  public async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    this.prompts.delete(id);
  }

  public async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    const prompts = Array.from(this.prompts.values());
    return this.filterPrompts(prompts, options);
  }

  private filterPrompts(prompts: Prompt[], options?: ListPromptsOptions): Prompt[] {
    if (!options) {
      return prompts;
    }

    let filtered = prompts;

    if (options.isTemplate !== undefined) {
      filtered = filtered.filter(p => p.isTemplate === options.isTemplate);
    }

    if (options.category) {
      filtered = filtered.filter(p => p.category === options.category);
    }

    if (options.tags && options.tags.length > 0) {
      const lowerCaseTags = options.tags.map(t => t.toLowerCase());
      filtered = filtered.filter(p => {
        if (!p.tags) return false;
        const lowerCasePromptTags = p.tags.map(t => t.toLowerCase());
        return lowerCaseTags.every(t => lowerCasePromptTags.includes(t));
      });
    }

    return filtered;
  }

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  public async getAllPrompts(): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    return Array.from(this.prompts.values());
  }

  public async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  public async clearAll(): Promise<void> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    this.prompts.clear();
    this.sequences.clear();
  }

  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    this.workflowStates.set(state.executionId, state);
  }

  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    return this.workflowStates.get(executionId) || null;
  }

  public async listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]> {
    return Array.from(this.workflowStates.values()).filter(
      state => state.workflowId === workflowId,
    );
  }
}

/**
 * PostgresAdapter Implementation
 * Stores prompts in a PostgreSQL database
 */
export class PostgresAdapter implements StorageAdapter {
  private pool: pg.Pool;
  private connected = false;
  private config: pg.PoolConfig;
  private maxRetries = 5;
  private retryDelay = 1000; // 1 second

  public constructor(config: pg.PoolConfig) {
    this.config = {
      max: 20, // Increased pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // 10-second timeout
      ...config,
    };
    this.pool = new pg.Pool(this.config);
  }

  public async connect(): Promise<void> {
    let retries = this.maxRetries;
    while (retries > 0) {
      try {
        const client = await this.pool.connect();
        this.connected = true;
        console.error('Postgres storage connected');
        client.release();
        return;
      } catch (error: unknown) {
        console.error(`Error connecting to Postgres (retries left: ${retries - 1}):`, error);
        retries--;
        if (retries === 0) {
          throw new Error('Failed to connect to Postgres after multiple retries.');
        }
        await new Promise(res => setTimeout(res, this.retryDelay));
      }
    }
  }

  public async disconnect(): Promise<void> {
    await this.pool.end();
    this.connected = false;
    console.log('Postgres storage disconnected');
  }

  private async getOrCreateTagIds(tagNames: string[]): Promise<number[]> {
    if (tagNames.length === 0) {
      return [];
    }

    const tags = await this.pool.query('SELECT id, name FROM tags WHERE name = ANY($1)', [
      tagNames,
    ]);
    const existingTags = new Map(tags.rows.map(t => [t.name, t.id]));
    const newTags = tagNames.filter(name => !existingTags.has(name));

    if (newTags.length > 0) {
      const newTagIds = await this.pool.query(
        `INSERT INTO tags (name) SELECT unnest($1::text[]) RETURNING id, name`,
        [newTags],
      );
      newTagIds.rows.forEach(row => existingTags.set(row.name, row.id));
    }

    return tagNames.map(name => existingTags.get(name)!);
  }

  private async setPromptTags(promptId: number, tagNames: string[]): Promise<void> {
    const tagIds = await this.getOrCreateTagIds(tagNames);
    await this.pool.query('DELETE FROM prompt_tags WHERE prompt_id = $1', [promptId]);
    for (const tagId of tagIds) {
      await this.pool.query('INSERT INTO prompt_tags (prompt_id, tag_id) VALUES ($1, $2)', [
        promptId,
        tagId,
      ]);
    }
  }

  private async setTemplateVariables(
    promptId: number,
    variables: string[] | undefined,
  ): Promise<void> {
    await this.pool.query('DELETE FROM template_variables WHERE prompt_id = $1', [promptId]);
    if (variables) {
      for (const variable of variables) {
        await this.pool.query('INSERT INTO template_variables (prompt_id, name) VALUES ($1, $2)', [
          promptId,
          variable,
        ]);
      }
    }
  }

  private async getTagsForPrompt(promptId: number): Promise<string[]> {
    const res = await this.pool.query(
      'SELECT name FROM tags t JOIN prompt_tags pt ON t.id = pt.tag_id WHERE pt.prompt_id = $1',
      [promptId],
    );
    return res.rows.map(r => r.name);
  }

  private async getVariablesForPrompt(promptId: number): Promise<string[]> {
    const res = await this.pool.query('SELECT name FROM template_variables WHERE prompt_id = $1', [
      promptId,
    ]);
    return res.rows.map(r => r.name);
  }

  private async getPromptIdByName(name: string): Promise<number | null> {
    const res = await this.pool.query('SELECT id FROM prompts WHERE name = $1', [name]);
    return res.rows[0]?.id || null;
  }

  private extractVariableNames(variables: string[] | { name: string }[] | undefined): string[] {
    if (!variables) {
      return [];
    }
    return variables.map(v => (typeof v === 'string' ? v : v.name));
  }

  public async savePrompt(prompt: Prompt): Promise<Prompt> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const variableNames = this.extractVariableNames(prompt.variables);
      const res = await client.query(
        'INSERT INTO prompts (id, name, description, content, is_template, tags, variables, category, version, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
        [
          prompt.id,
          prompt.name,
          prompt.description,
          prompt.content,
          prompt.isTemplate,
          prompt.tags,
          variableNames,
          prompt.category,
          prompt.version,
          prompt.metadata,
        ],
      );
      const promptId = res.rows[0].id;
      await this.setPromptTags(promptId, prompt.tags || []);
      await this.setTemplateVariables(promptId, variableNames);

      await client.query('COMMIT');

      return this.getPromptById(promptId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async getPromptById(id: number): Promise<Prompt> {
    const res = await this.pool.query('SELECT * FROM prompts WHERE id = $1', [id]);
    const p = res.rows[0];
    const tags = await this.getTagsForPrompt(p.id);
    const variables = await this.getVariablesForPrompt(p.id);

    return {
      category: p.category,
      content: p.content,
      createdAt: p.created_at,
      description: p.description,
      id: p.id.toString(),
      isTemplate: p.is_template,
      metadata: p.metadata,
      name: p.name,
      tags,
      updatedAt: p.updated_at,
      variables,
      version: p.version,
    };
  }

  public async getPrompt(idOrName: string): Promise<Prompt | null> {
    const isNumericId = /^\d+$/.test(idOrName);
    let promptId: number | null;

    if (isNumericId) {
      promptId = parseInt(idOrName, 10);
    } else {
      promptId = await this.getPromptIdByName(idOrName);
    }

    if (promptId === null) {
      return null;
    }

    return this.getPromptById(promptId);
  }

  public async updatePrompt(idOrName: string, prompt: Prompt): Promise<Prompt> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const isNumericId = /^\d+$/.test(idOrName);
      const result = await client.query(
        `SELECT id FROM prompts WHERE ${isNumericId ? 'id = $1' : 'name = $1'}`,
        [isNumericId ? parseInt(idOrName, 10) : idOrName],
      );
      const promptId = result.rows[0]?.id;

      if (!promptId) {
        throw new Error(`Prompt not found: ${idOrName}`);
      }

      const updateFields: Record<string, any> = {};
      if (prompt.name) updateFields.name = prompt.name;
      if (prompt.description) updateFields.description = prompt.description;
      if (prompt.content) updateFields.content = prompt.content;
      if (prompt.isTemplate !== undefined) updateFields.is_template = prompt.isTemplate;
      if (prompt.category) updateFields.category = prompt.category;
      if (prompt.metadata) updateFields.metadata = prompt.metadata;
      if (prompt.version) updateFields.version = prompt.version;
      updateFields.updated_at = new Date();

      const fieldEntries = Object.entries(updateFields);
      if (fieldEntries.length > 0) {
        const setClause = fieldEntries.map(([key], i) => `${key} = $${i + 2}`).join(', ');
        const values = fieldEntries.map(([, value]) => value);
        await client.query(`UPDATE prompts SET ${setClause} WHERE id = $1`, [promptId, ...values]);
      }

      if (prompt.tags) {
        await this.setPromptTags(promptId, prompt.tags);
      }
      if (prompt.variables) {
        await this.setTemplateVariables(promptId, this.extractVariableNames(prompt.variables));
      }

      await client.query('COMMIT');

      return this.getPromptById(promptId);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  public async deletePrompt(idOrName: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const isNumericId = /^\d+$/.test(idOrName);
      const result = await client.query(
        `SELECT id FROM prompts WHERE ${isNumericId ? 'id = $1' : 'name = $1'}`,
        [isNumericId ? parseInt(idOrName, 10) : idOrName],
      );
      const promptId = result.rows[0]?.id;

      if (promptId) {
        await client.query('DELETE FROM prompt_tags WHERE prompt_id = $1', [promptId]);
        await client.query('DELETE FROM template_variables WHERE prompt_id = $1', [promptId]);
        await client.query('DELETE FROM prompts WHERE id = $1', [promptId]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  public async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    let query = 'SELECT DISTINCT p.* FROM prompts p';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.tags?.length) {
      query += ` JOIN prompt_tags pt ON p.id = pt.prompt_id JOIN tags t ON pt.tag_id = t.id`;
    }

    const whereClauses: string[] = [];

    if (options?.isTemplate !== undefined) {
      whereClauses.push(`p.is_template = $${paramIndex++}`);
      params.push(options.isTemplate);
    }

    if (options?.category) {
      whereClauses.push(`p.category = $${paramIndex++}`);
      params.push(options.category);
    }

    if (options?.tags?.length) {
      whereClauses.push(`t.name = ANY($${paramIndex++})`);
      params.push(options.tags);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ' ORDER BY p.updated_at DESC';

    const res = await this.pool.query(query, params);
    const prompts = await Promise.all(res.rows.map(row => this.getPromptById(row.id)));

    return prompts;
  }

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    console.warn(`getSequence not implemented for PostgresAdapter, ID: ${id}`);
    return null;
  }

  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    console.warn('saveSequence not implemented for PostgresAdapter');
    return sequence;
  }

  public async deleteSequence(id: string): Promise<void> {
    console.warn(`deleteSequence not implemented for PostgresAdapter, ID: ${id}`);
  }

  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    const {
      executionId,
      workflowId,
      status,
      context,
      currentStepId,
      history,
      createdAt,
      updatedAt,
    } = state;
    const query = `
      INSERT INTO workflow_executions (id, workflow_id, status, context, current_step_id, history, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        context = EXCLUDED.context,
        current_step_id = EXCLUDED.current_step_id,
        history = EXCLUDED.history,
        updated_at = EXCLUDED.updated_at;
    `;
    await this.pool.query(query, [
      executionId,
      workflowId,
      status,
      context,
      currentStepId,
      JSON.stringify(history),
      createdAt,
      updatedAt,
    ]);
  }

  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    const res = await this.pool.query('SELECT * FROM workflow_executions WHERE id = $1', [
      executionId,
    ]);
    if (res.rows.length === 0) {
      return null;
    }
    const row = res.rows[0];
    return {
      executionId: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      context: row.context,
      currentStepId: row.current_step_id,
      history: row.history,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public async listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]> {
    const res = await this.pool.query(
      'SELECT * FROM workflow_executions WHERE workflow_id = $1 ORDER BY updated_at DESC',
      [workflowId],
    );
    return res.rows.map(row => ({
      executionId: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      context: row.context,
      currentStepId: row.current_step_id,
      history: row.history,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  public async clearAll(): Promise<void> {
    await this.pool.query(
      'TRUNCATE prompts, tags, prompt_tags, template_variables RESTART IDENTITY',
    );
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch {
      return false;
    }
  }

  public async getAllPrompts(): Promise<Prompt[]> {
    const res = await this.pool.query('SELECT id FROM prompts ORDER BY updated_at DESC');
    const prompts = await Promise.all(res.rows.map(row => this.getPromptById(row.id)));
    return prompts;
  }
}

/**
 * A factory function that creates a storage adapter based on the provided configuration.
 * This allows the server to be agnostic about the storage implementation.
 */
export function adapterFactory(config: McpConfig, logger: pino.Logger): StorageAdapter {
  switch (config.storage.type) {
    case 'postgres':
      logger.info('Using PostgreSQL storage adapter');
      return new PostgresAdapter(config.storage);
    case 'file':
      logger.info(`Using file storage adapter with directory: ${config.storage.promptsDir}`);
      return new FileAdapter(config.storage.promptsDir);
    default:
      if (config.storage.type) {
        throw new Error(`Unknown storage type: ${config.storage.type}`);
      }
      // Fallback to a default or handle the case where type is not specified
      logger.warn('Storage type not specified, falling back to in-memory storage.');
      return new MemoryAdapter();
  }
}
