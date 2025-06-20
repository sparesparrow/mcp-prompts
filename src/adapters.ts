/**
 * Consolidated Adapters Module
 * Contains all storage adapters in a single file
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { glob } from 'glob';
import paramCase from 'param-case';
import { pino } from 'pino';

import type {
  ListPromptsOptions,
  McpConfig,
  Prompt,
  PromptSequence,
  StorageAdapter,
} from './interfaces.js';

export type { StorageAdapter };

/**
 * FileAdapter Implementation
 * Stores prompts as individual JSON files in a directory
 */
export class FileAdapter implements StorageAdapter {
  private promptsDir: string;
  private sequencesDir: string;
  private connected = false;
  private prompts: Map<string, Prompt> = new Map();

  public constructor(promptsDir: string) {
    this.promptsDir = promptsDir;
    this.sequencesDir = path.join(promptsDir, 'sequences');
  }

  public async connect(): Promise<void> {
    try {
      await fs.mkdir(this.promptsDir, { recursive: true });
      await fs.mkdir(this.sequencesDir, { recursive: true });
      this.connected = true;
      console.error(`File storage connected: ${this.promptsDir}`);
    } catch (error: any) {
      console.error('Error connecting to file storage:', error);
      throw new Error(`Failed to connect to file storage: ${error.message}`);
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

    try {
      await fs.writeFile(
        path.join(this.promptsDir, `${prompt.id}.json`),
        JSON.stringify(prompt, null, 2),
      );
      return prompt;
    } catch (error: any) {
      console.error('Error saving prompt to file:', error);
      throw error;
    }
  }

  public async getPrompt(id: string): Promise<Prompt | null> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    try {
      const content = await fs.readFile(path.join(this.promptsDir, `${id}.json`), 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
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

    try {
      await fs.writeFile(path.join(this.promptsDir, `${id}.json`), JSON.stringify(prompt, null, 2));
      return prompt;
    } catch (error: any) {
      console.error(`Error updating prompt ${id} in file:`, error);
      throw error;
    }
  }

  public async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }
    try {
      await fs.unlink(path.join(this.promptsDir, `${id}.json`));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // no return value
      }
      console.error(`Error deleting prompt ${id} from file:`, error);
      throw error;
    }
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    try {
      const content = await fs.readFile(path.join(this.sequencesDir, `${id}.json`), 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
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

    try {
      await fs.writeFile(
        path.join(this.sequencesDir, `${sequence.id}.json`),
        JSON.stringify(sequence, null, 2),
      );
      return sequence;
    } catch (error: any) {
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
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error deleting sequence ${id} from file:`, error);
        throw error;
      }
    }
  }

  public async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    try {
      const files = await fs.readdir(this.promptsDir);
      const prompts: Prompt[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(this.promptsDir, file), 'utf-8');
            prompts.push(JSON.parse(content));
          } catch (error: any) {
            console.error(`Error reading prompt file ${file}:`, error);
          }
        }
      }

      return this.filterPrompts(prompts, options);
    } catch (error: any) {
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

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  private generateId(name: string): string {
    // Simple slug-like ID for MDC
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

/**
 * MemoryAdapter Implementation
 * Stores prompts in memory (volatile storage)
 */
export class MemoryAdapter implements StorageAdapter {
  private prompts: Map<string, Prompt> = new Map();
  private sequences: Map<string, PromptSequence> = new Map();
  private connected = false;

  public async connect(): Promise<void> {
    this.connected = true;
    console.log('Memory storage connected');
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

  public async clearAll(): Promise<void> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    this.prompts.clear();
    this.sequences.clear();
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

  public constructor(config: pg.PoolConfig) {
    this.config = config;
    this.pool = new pg.Pool(config);
  }

  public async connect(): Promise<void> {
    this.pool = new pg.Pool(this.config);
    await this.pool.query('SELECT 1');
      this.connected = true;
    console.log('Postgres storage connected');
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

      const variableNames = this.extractVariableNames(prompt.variables as any);
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
    const promptId = isNaN(parseInt(idOrName))
      ? await this.getPromptIdByName(idOrName)
      : parseInt(idOrName, 10);
    if (!promptId) {
      throw new Error(`Prompt not found: ${idOrName}`);
    }
    // Update logic here
    return prompt;
  }

  public async deletePrompt(idOrName: string): Promise<void> {
    const promptId = isNaN(parseInt(idOrName))
      ? await this.getPromptIdByName(idOrName)
      : parseInt(idOrName, 10);
    if (promptId) {
      await this.pool.query('DELETE FROM prompts WHERE id = $1', [promptId]);
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

  public async clearAll(): Promise<void> {
    await this.pool.query(
      'TRUNCATE prompts, tags, prompt_tags, template_variables RESTART IDENTITY',
    );
  }

  public async getAllPrompts(): Promise<Prompt[]> {
    const res = await this.pool.query('SELECT id FROM prompts');
    return Promise.all(res.rows.map(row => this.getPromptById(row.id)));
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
      throw new Error(`Unknown storage type: ${config.storage.type}`);
  }
}
