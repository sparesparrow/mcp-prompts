/**
 * Consolidated Adapters Module
 * Contains all storage adapters in a single file
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

import type { ListPromptsOptions, Prompt, PromptSequence, StorageAdapter } from './interfaces.js';
import {
  MdcFormatOptions,
  MutablePrompt,
  MutablePromptFactory,
  PgaiFormatOptions,
  PromptConversionOptions,
  PromptFormat,
  ServerConfig,
  TemplateFormatOptions,
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
      filtered = filtered.filter(p => {
        if (!p.tags) return false;
        return options.tags!.every(tag => p.tags!.includes(tag));
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
      filtered = filtered.filter(p => {
        if (!p.tags) return false;
        return options.tags!.every(tag => p.tags!.includes(tag));
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
}

/**
 * PostgresAdapter Implementation
 * Stores prompts in a normalized PostgreSQL schema (see docker/postgres/init/01-init.sql)
 */
export class PostgresAdapter implements StorageAdapter {
  private pool: pg.Pool;
  private connected = false;

  public constructor(config: pg.PoolConfig) {
    this.pool = new pg.Pool(config);
  }

  public async connect(): Promise<void> {
    try {
      await this.pool.query('SELECT NOW()');
      this.connected = true;
      console.error('PostgreSQL storage connected');
    } catch (error: any) {
      console.error('Error connecting to PostgreSQL:', error);
      throw new Error(`Failed to connect to PostgreSQL: ${error.message}`);
    }
  }

  public async disconnect(): Promise<void> {
    await this.pool.end();
    this.connected = false;
    console.error('PostgreSQL storage disconnected');
  }

  // Helper: Get or create tag IDs for a list of tag names
  private async getOrCreateTagIds(tagNames: string[]): Promise<number[]> {
    const client = await this.pool.connect();
    try {
      const tagIds: number[] = [];
      for (const name of tagNames) {
        // Try to get existing tag
        const res = await client.query('SELECT id FROM mcp_prompts.tags WHERE name = $1', [name]);
        if (res.rows.length > 0) {
          tagIds.push(res.rows[0].id);
        } else {
          // Insert new tag
          const insert = await client.query(
            'INSERT INTO mcp_prompts.tags (name) VALUES ($1) RETURNING id',
            [name],
          );
          tagIds.push(insert.rows[0].id);
        }
      }
      return tagIds;
    } finally {
      client.release();
    }
  }

  // Helper: Set tags for a prompt (replace all)
  private async setPromptTags(promptId: number, tagNames: string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Remove old tags
      await client.query('DELETE FROM mcp_prompts.prompt_tags WHERE prompt_id = $1', [promptId]);
      if (tagNames.length === 0) return;
      const tagIds = await this.getOrCreateTagIds(tagNames);
      for (const tagId of tagIds) {
        await client.query(
          'INSERT INTO mcp_prompts.prompt_tags (prompt_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [promptId, tagId],
        );
      }
    } finally {
      client.release();
    }
  }

  // Helper: Set template variables for a prompt (replace all)
  private async setTemplateVariables(
    promptId: number,
    variables: string[] | undefined,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM mcp_prompts.template_variables WHERE prompt_id = $1', [
        promptId,
      ]);
      if (!variables || variables.length === 0) return;
      for (const name of variables) {
        await client.query(
          'INSERT INTO mcp_prompts.template_variables (prompt_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [promptId, name],
        );
      }
    } finally {
      client.release();
    }
  }

  // Helper: Get tags for a prompt
  private async getTagsForPrompt(promptId: number): Promise<string[]> {
    const res = await this.pool.query(
      `SELECT t.name FROM mcp_prompts.tags t
       JOIN mcp_prompts.prompt_tags pt ON t.id = pt.tag_id
       WHERE pt.prompt_id = $1`,
      [promptId],
    );
    return res.rows.map(r => r.name);
  }

  // Helper: Get template variables for a prompt
  private async getVariablesForPrompt(promptId: number): Promise<string[]> {
    const res = await this.pool.query(
      `SELECT name FROM mcp_prompts.template_variables WHERE prompt_id = $1`,
      [promptId],
    );
    return res.rows.map(r => r.name);
  }

  // Helper: Get prompt by name (for unique constraint)
  private async getPromptIdByName(name: string): Promise<number | null> {
    const res = await this.pool.query('SELECT id FROM mcp_prompts.prompts WHERE name = $1', [name]);
    return res.rows.length > 0 ? res.rows[0].id : null;
  }

  // Helper: Extract variable names from Prompt.variables (string[] | TemplateVariable[] | undefined)
  private extractVariableNames(variables: string[] | { name: string }[] | undefined): string[] {
    if (!variables) return [];
    if (typeof variables[0] === 'string') return variables as string[];
    return (variables as { name: string }[]).map(v => v.name);
  }

  // Save (insert or update) prompt
  public async savePrompt(prompt: Prompt): Promise<Prompt> {
    if (!this.connected) throw new Error('PostgreSQL storage not connected');
    const client = await this.pool.connect();
    try {
      // Check if prompt exists (by name)
      let promptId = await this.getPromptIdByName(prompt.name);
      let res;
      if (promptId !== null) {
        // Update
        res = await client.query(
          `UPDATE mcp_prompts.prompts SET
            description = $1,
            content = $2,
            is_template = $3,
            metadata = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 RETURNING *`,
          [
            prompt.description,
            prompt.content,
            prompt.isTemplate || false,
            JSON.stringify(prompt.metadata || {}),
            promptId,
          ],
        );
      } else {
        // Insert
        res = await client.query(
          `INSERT INTO mcp_prompts.prompts (name, description, content, is_template, metadata)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [
            prompt.name,
            prompt.description,
            prompt.content,
            prompt.isTemplate || false,
            JSON.stringify(prompt.metadata || {}),
          ],
        );
        promptId = res.rows[0].id;
      }
      if (promptId === null) throw new Error('Failed to get prompt ID after save');
      // Set tags and variables
      await this.setPromptTags(promptId, prompt.tags || []);
      await this.setTemplateVariables(promptId, this.extractVariableNames(prompt.variables));
      // Return full prompt
      return await this.getPromptById(promptId);
    } catch (error) {
      console.error('Error saving prompt to PostgreSQL:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get prompt by ID (internal helper)
  private async getPromptById(id: number): Promise<Prompt> {
    const res = await this.pool.query('SELECT * FROM mcp_prompts.prompts WHERE id = $1', [id]);
    if (res.rows.length === 0) throw new Error(`Prompt with id ${id} not found`);
    const row = res.rows[0];
    const tags = await this.getTagsForPrompt(id);
    const variables = await this.getVariablesForPrompt(id);
    return {
      content: row.content,
      createdAt: row.created_at,
      description: row.description,
      id: row.id.toString(),
      isTemplate: row.is_template,
      metadata: row.metadata,
      name: row.name,
      tags,
      updatedAt: row.updated_at,
      variables,
      version: row.version || 1,
    };
  }

  // Get prompt by name (public API)
  public async getPrompt(idOrName: string): Promise<Prompt | null> {
    if (!this.connected) throw new Error('PostgreSQL storage not connected');
    // Try by numeric ID first
    let idNum = parseInt(idOrName, 10);
    let prompt: Prompt | null = null;
    if (!isNaN(idNum)) {
      try {
        prompt = await this.getPromptById(idNum);
      } catch {
        prompt = null;
      }
    }
    if (!prompt) {
      // Try by name
      const promptId = await this.getPromptIdByName(idOrName);
      if (promptId) {
        prompt = await this.getPromptById(promptId);
      }
    }
    return prompt;
  }

  // Update prompt (by name or ID)
  public async updatePrompt(idOrName: string, prompt: Prompt): Promise<Prompt> {
    if (!this.connected) throw new Error('PostgreSQL storage not connected');
    let promptId = parseInt(idOrName, 10);
    if (isNaN(promptId)) {
      promptId = (await this.getPromptIdByName(idOrName)) || 0;
    }
    if (!promptId) throw new Error(`Prompt not found: ${idOrName}`);
    // SavePrompt will update if exists
    return this.savePrompt({ ...prompt, id: promptId.toString() });
  }

  // Delete prompt
  public async deletePrompt(idOrName: string): Promise<void> {
    if (!this.connected) throw new Error('PostgreSQL storage not connected');
    let promptId = parseInt(idOrName, 10);
    if (isNaN(promptId)) {
      const foundId = await this.getPromptIdByName(idOrName);
      if (!foundId) throw new Error(`Prompt not found: ${idOrName}`);
      promptId = foundId;
    }
    if (!promptId) throw new Error(`Prompt not found: ${idOrName}`);
    await this.pool.query('DELETE FROM mcp_prompts.prompts WHERE id = $1', [promptId]);
  }

  // List prompts (optionally filter by isTemplate, tags, etc.)
  public async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) throw new Error('PostgreSQL storage not connected');
    let query = 'SELECT * FROM mcp_prompts.prompts_with_tags';
    const params: any[] = [];
    const conditions: string[] = [];
    if (options) {
      if (options.isTemplate !== undefined) {
        conditions.push('is_template = $' + (params.length + 1));
        params.push(options.isTemplate);
      }
      if (options.tags && options.tags.length > 0) {
        conditions.push('tags @> $' + (params.length + 1));
        params.push(JSON.stringify(options.tags));
      }
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    const res = await this.pool.query(query, params);
    // For each row, fetch variables
    const prompts: Prompt[] = [];
    for (const row of res.rows) {
      const variables = await this.getVariablesForPrompt(row.id);
      prompts.push({
        content: row.content,
        createdAt: row.created_at,
        description: row.description,
        id: row.id.toString(),
        isTemplate: row.is_template,
        metadata: row.metadata,
        name: row.name,
        tags: row.tags,
        updatedAt: row.updated_at,
        variables,
        version: row.version || 1,
      });
    }
    return prompts;
  }

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  // Sequence methods (not implemented)
  public async getSequence(id: string): Promise<PromptSequence | null> {
    return Promise.reject(new Error('Method not implemented.'));
  }
  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    return Promise.reject(new Error('Method not implemented.'));
  }
  public async deleteSequence(id: string): Promise<void> {
    return Promise.reject(new Error('Method not implemented.'));
  }

  // Test helper: clear all data (truncate tables)
  public async clearAll(): Promise<void> {
    if (!this.connected) throw new Error('PostgreSQL storage not connected');
    const client = await this.pool.connect();
    try {
      await client.query(
        'TRUNCATE mcp_prompts.prompt_tags, mcp_prompts.template_variables, mcp_prompts.tags, mcp_prompts.prompts RESTART IDENTITY CASCADE',
      );
    } finally {
      client.release();
    }
  }

  // Return all prompts (required by StorageAdapter interface)
  public async getAllPrompts(): Promise<Prompt[]> {
    return this.listPrompts();
  }
}

/**
 * MdcAdapter Implementation (Cursor Rules)
 * Stores prompts as .mdc files in a directory using Markdown frontmatter
 */
export class MdcAdapter implements StorageAdapter {
  private rulesDir: string;
  private connected = false;

  public constructor(rulesDir: string) {
    this.rulesDir = rulesDir;
  }

  public async connect(): Promise<void> {
    await fs.mkdir(this.rulesDir, { recursive: true });
    this.connected = true;
    console.error(`MDC storage connected: ${this.rulesDir}`);
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
    console.error('MDC storage disconnected');
  }

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  private getFilePath(id: string): string {
    return path.join(this.rulesDir, `${id}.mdc`);
  }

  public async savePrompt(prompt: Prompt, overwrite = false): Promise<Prompt> {
    if (!this.connected) throw new Error('MDC adapter not connected');
    const id = prompt.id || this.generateId(prompt.name);
    prompt.id = id;
    if (!overwrite) {
      const existing = await this.getPrompt(id);
      if (existing) throw new Error(`Prompt with id '${id}' already exists`);
    }
    const mdcContent = this.promptToMdc(prompt);
    await fs.writeFile(this.getFilePath(id), mdcContent, 'utf8');
    return prompt;
  }

  public async getPrompt(id: string): Promise<Prompt | null> {
    if (!this.connected) throw new Error('MDC adapter not connected');
    try {
      const mdcContent = await fs.readFile(this.getFilePath(id), 'utf8');
      return this.mdcToPrompt(id, mdcContent);
    } catch (error: any) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  public async updatePrompt(id: string, prompt: Prompt): Promise<Prompt> {
    if (!this.connected) throw new Error('MDC adapter not connected');
    const existing = await this.getPrompt(id);
    if (!existing) throw new Error(`Prompt not found: ${id}`);
    const updated: Prompt = { ...existing, ...prompt, id, updatedAt: new Date().toISOString() };
    await this.savePrompt(updated, true);
    return updated;
  }

  public async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error('MDC storage not connected');
    }
    const filePath = this.getFilePath(id);
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // no return value
      }
      throw error;
    }
  }

  public async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) throw new Error('MDC adapter not connected');
    const files = await fs.readdir(this.rulesDir);
    const prompts: Prompt[] = [];
    for (const file of files) {
      if (file.endsWith('.mdc')) {
        const id = path.basename(file, '.mdc');
        try {
          const prompt = await this.getPrompt(id);
          if (prompt) prompts.push(prompt);
        } catch (error) {
          console.error(`Error reading prompt ${id}:`, error);
        }
      }
    }
    return this.filterPrompts(prompts, options);
  }

  public async getAllPrompts(): Promise<Prompt[]> {
    return this.listPrompts();
  }

  // Sequence support: not implemented for MDC, return null/empty
  public async getSequence(_id: string): Promise<PromptSequence | null> {
    return null;
  }
  public async saveSequence(_sequence: PromptSequence): Promise<PromptSequence> {
    throw new Error('Sequences not supported in MDC adapter');
  }
  public async deleteSequence(_id: string): Promise<void> {
    throw new Error('Sequences not supported in MDC adapter');
  }

  private filterPrompts(prompts: Prompt[], options?: ListPromptsOptions): Prompt[] {
    if (!options) return prompts;
    let filtered = prompts;
    if (options.isTemplate !== undefined) {
      filtered = filtered.filter(p => p.isTemplate === options.isTemplate);
    }
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(p => p.tags && options.tags!.every(tag => p.tags!.includes(tag)));
    }
    if (options.category) {
      filtered = filtered.filter(p => p.category === options.category);
    }
    if (options.search) {
      const term = options.search.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(term) ||
          (p.description && p.description.toLowerCase().includes(term)) ||
          p.content.toLowerCase().includes(term),
      );
    }
    return filtered;
  }

  private promptToMdc(prompt: Prompt): string {
    let mdc = '---\n';
    mdc += `description: ${prompt.description || ''}\n`;
    if (prompt.tags && prompt.tags.length > 0) {
      const globs = this.extractGlobsFromTags(prompt.tags);
      if (globs.length > 0) {
        mdc += `globs: ${JSON.stringify(globs)}\n`;
      }
    }
    mdc += '---\n\n';
    mdc += `# ${prompt.name}\n\n`;
    mdc += prompt.content;
    if (prompt.isTemplate && prompt.variables && prompt.variables.length > 0) {
      mdc += '\n\n## Variables\n\n';
      for (const variable of prompt.variables) {
        mdc += `- \`${variable}\`\n`;
      }
    }
    return mdc;
  }

  private mdcToPrompt(id: string, mdcContent: string): Prompt {
    const frontmatterMatch = mdcContent.match(/---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';
    const descriptionMatch = frontmatter.match(/description: (.*)/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    const globsMatch = frontmatter.match(/globs: (\[.*\])/);
    const globs = globsMatch ? JSON.parse(globsMatch[1]) : [];
    const tags = globs.map((glob: string) => `glob:${glob}`);
    const titleMatch = mdcContent.match(/# (.*)/);
    const name = titleMatch ? titleMatch[1].trim() : id;
    const content = mdcContent.replace(/---\n[\s\S]*?\n---\n\n# .*\n\n/, '');
    const variables = this.extractVariablesFromContent(content);
    return {
      content,
      createdAt: new Date().toISOString(),
      description,
      id,
      isTemplate: variables.length > 0,
      name,
      tags,
      updatedAt: new Date().toISOString(),
      variables,
    };
  }

  private extractGlobsFromTags(tags: string[]): string[] {
    return tags.filter(tag => tag.startsWith('glob:')).map(tag => tag.replace('glob:', ''));
  }

  private extractVariablesFromContent(content: string): string[] {
    const varSection = content.match(/## Variables\n\n([\s\S]*?)(\n\n|$)/);
    if (!varSection) return [];
    const varContent = varSection[1];
    return varContent
      .split('\n')
      .map(line => {
        const match = line.match(/- `([^`]+)`/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
  }

  private generateId(name: string): string {
    // Simple slug-like ID for MDC
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

export interface StorageConfig {
  type: 'file' | 'memory' | 'postgres' | 'mdc';
  promptsDir?: string;
  backupsDir?: string;
  postgres?: pg.PoolConfig;
  mdcRulesDir?: string;
}

/**
 *
 * @param config
 */
export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.type) {
    case 'file':
      if (!config.promptsDir) {
        throw new Error('File storage requires promptsDir in config');
      }
      return new FileAdapter(config.promptsDir);
    case 'memory':
      return new MemoryAdapter();
    case 'postgres':
      if (!config.postgres) {
        throw new Error('Postgres storage requires postgres in config');
      }
      return new PostgresAdapter(config.postgres);
    case 'mdc':
      if (!config.mdcRulesDir) {
        throw new Error('MDC storage requires mdcRulesDir in config');
      }
      return new MdcAdapter(config.mdcRulesDir);
    default:
      throw new Error(`Unsupported storage type: ${config.type}`);
  }
}
