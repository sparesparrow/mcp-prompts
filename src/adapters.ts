/**
 * Consolidated Adapters Module
 * Contains all storage adapters in a single file
 */

import fs from 'fs';
import * as fsp from 'fs/promises';
import path from 'path';

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
        await fsp.mkdir(this.promptsDir, { recursive: true });
        await fsp.mkdir(this.sequencesDir, { recursive: true });
        await fsp.mkdir(this.workflowStatesDir, { recursive: true });
        console.error(`File storage connected: ${this.promptsDir}`);

        // Validate existing prompts on startup
        const files = await fsp.readdir(this.promptsDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(this.promptsDir, file);
            try {
              const content = await fsp.readFile(filePath, 'utf-8');
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

  private getPromptFileName(id: string, version: number) {
    return path.join(this.promptsDir, `${id}-v${version}.json`);
  }

  public async savePrompt(prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }
    validatePrompt(prompt, true);
    const finalPath = this.getPromptFileName(prompt.id, prompt.version ?? 1);
    const tempPath = `${finalPath}.tmp`;
    try {
      await fsp.writeFile(tempPath, JSON.stringify(prompt, null, 2));
      await fsp.rename(tempPath, finalPath);
      return prompt;
    } catch (error: unknown) {
      try { await fsp.unlink(tempPath); } catch {}
      throw error;
    }
  }

  public async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    if (!this.connected) throw new Error('File storage not connected');
    if (version !== undefined) {
      try {
        const content = await fsp.readFile(this.getPromptFileName(id, version), 'utf-8');
        const prompt = JSON.parse(content);
        validatePrompt(prompt, true);
        return prompt;
      } catch (error: unknown) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        return null;
      }
    }
    // If no version, get the highest version
    const files = (await fsp.readdir(this.promptsDir)).filter(f => f.startsWith(`${id}-v`) && f.endsWith('.json'));
    if (files.length === 0) return null;
    const versions = files.map(f => {
      const match = f.match(/-v(\d+)\.json$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxVersion = Math.max(...versions);
    return this.getPrompt(id, maxVersion);
  }

  public async listPromptVersions(id: string): Promise<number[]> {
    if (!this.connected) throw new Error('File storage not connected');
    const files = (await fsp.readdir(this.promptsDir)).filter(f => f.startsWith(`${id}-v`) && f.endsWith('.json'));
    return files
      .map(f => {
        const match = f.match(/-v(\d+)\.json$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(v => v !== null) as number[];
  }

  public async updatePrompt(id: string, version: number, prompt: Prompt): Promise<Prompt> {
    if (!this.connected) throw new Error('File storage not connected');
    validatePrompt(prompt, true);
    const finalPath = this.getPromptFileName(id, version);
    const tempPath = `${finalPath}.tmp`;
    try {
      const updatedPrompt = { ...prompt, id, version, updatedAt: new Date().toISOString() };
      validatePrompt(updatedPrompt, true);
      await fsp.writeFile(tempPath, JSON.stringify(updatedPrompt, null, 2));
      await fsp.rename(tempPath, finalPath);
      return updatedPrompt;
    } catch (error: unknown) {
      try { await fsp.unlink(tempPath); } catch {}
      throw error;
    }
  }

  public async deletePrompt(id: string, version?: number): Promise<void> {
    if (!this.connected) throw new Error('File storage not connected');
    if (version !== undefined) {
      try {
        await fsp.unlink(this.getPromptFileName(id, version));
      } catch (error: unknown) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
      return;
    }
    // Delete all versions
    const files = (await fsp.readdir(this.promptsDir)).filter(f => f.startsWith(`${id}-v`) && f.endsWith('.json'));
    for (const file of files) {
      try { await fsp.unlink(path.join(this.promptsDir, file)); } catch {}
    }
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    try {
      const content = await fsp.readFile(path.join(this.sequencesDir, `${id}.json`), 'utf-8');
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
      await fsp.writeFile(tempPath, JSON.stringify(sequence, null, 2));
      await fsp.rename(tempPath, finalPath);
      return sequence;
    } catch (error: unknown) {
      // Clean up the temp file if it exists
      try {
        await fsp.unlink(tempPath);
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
      await fsp.unlink(path.join(this.sequencesDir, `${id}.json`));
    } catch (error: unknown) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Error deleting sequence ${id} from file:`, error);
        throw error;
      }
    }
  }

  public async listPrompts(options?: ListPromptsOptions, allVersions = false): Promise<Prompt[]> {
    if (!this.connected) throw new Error('File storage not connected');
    const files = (await fsp.readdir(this.promptsDir)).filter(f => f.endsWith('.json'));
    const promptsById: Record<string, { version: number; file: string }[]> = {};
    files.forEach(f => {
      const match = f.match(/^(.*)-v(\d+)\.json$/);
      if (!match) return;
      const id = match[1];
      const version = parseInt(match[2], 10);
      if (!promptsById[id]) promptsById[id] = [];
      promptsById[id].push({ version, file: f });
    });
    const result: Prompt[] = [];
    Object.entries(promptsById).forEach(([id, versions]) => {
      const sorted = versions.sort((a, b) => b.version - a.version);
      if (allVersions) {
        sorted.forEach(({ file }) => {
          result.push(JSON.parse(fs.readFileSync(path.join(this.promptsDir, file), 'utf8')));
        });
      } else {
        const file = sorted[0].file;
        result.push(JSON.parse(fs.readFileSync(path.join(this.promptsDir, file), 'utf8')));
      }
    });
    // TODO: filter by options (category, tags, etc.)
    return result;
  }

  public async getAllPrompts(): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }
    return Array.from(this.prompts.values());
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await fsp.access(this.promptsDir);
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
    await fsp.writeFile(filePath, JSON.stringify(state, null, 2));
  }

  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    const filePath = path.join(this.workflowStatesDir, `${executionId}.json`);
    try {
      const content = await fsp.readFile(filePath, 'utf-8');
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
      const files = await fsp.readdir(this.workflowStatesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fsp.readFile(path.join(this.workflowStatesDir, file), 'utf-8');
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
  private prompts: Record<string, Record<number, Prompt>> = {};
  private sequences: Map<string, PromptSequence> = new Map();
  private workflowStates: Map<string, WorkflowExecutionState> = new Map();
  private connected = false;

  public async connect(): Promise<void> {
    this.connected = true;
    console.log('Memory storage connected');
    this.prompts = {};
    this.sequences.clear();
  }

  public async disconnect(): Promise<void> {
    this.prompts = {};
    this.sequences.clear();
    this.connected = false;
    console.log('Memory storage disconnected');
  }

  public async savePrompt(prompt: Prompt): Promise<Prompt> {
    if (!prompt.id || typeof prompt.version !== 'number') throw new Error('Prompt must have id and version');
    if (!this.prompts[prompt.id]) this.prompts[prompt.id] = {};
    if (this.prompts[prompt.id][prompt.version]) throw new Error('Prompt version already exists');
    this.prompts[prompt.id][prompt.version] = { ...prompt };
    return { ...prompt };
  }

  public async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    if (!this.prompts[id]) return null;
    if (version) return this.prompts[id][version] || null;
    // Return latest version
    const versions = Object.keys(this.prompts[id]).map(Number).sort((a, b) => b - a);
    if (versions.length === 0) return null;
    return this.prompts[id][versions[0]];
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

  public async updatePrompt(id: string, version: number, prompt: Prompt): Promise<Prompt> {
    if (!this.prompts[id] || !this.prompts[id][version]) throw new Error('Prompt version not found');
    this.prompts[id][version] = { ...prompt };
    return { ...prompt };
  }

  public async deletePrompt(id: string, version?: number): Promise<void> {
    if (!this.prompts[id]) return;
    if (version) {
      delete this.prompts[id][version];
      if (Object.keys(this.prompts[id]).length === 0) delete this.prompts[id];
    } else {
      delete this.prompts[id];
    }
  }

  public async listPrompts(options?: ListPromptsOptions, allVersions = false): Promise<Prompt[]> {
    const all: Prompt[] = [];
    for (const id in this.prompts) {
      const versions = this.prompts[id];
      const versionKeys = Object.keys(versions).map(Number);
      if (allVersions) {
        for (const v of versionKeys) all.push({ ...versions[v] });
      } else {
        const latest = Math.max(...versionKeys);
        all.push({ ...versions[latest] });
      }
    }
    // ... apply filters from args as before ...
    return all;
  }

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  public async getAllPrompts(): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    const allPrompts: Prompt[] = [];
    for (const id in this.prompts) {
      const versions = this.prompts[id];
      for (const version in versions) {
        allPrompts.push(versions[parseInt(version)]);
      }
    }
    return allPrompts;
  }

  public async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  public async clearAll(): Promise<void> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    this.prompts = {};
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

  public async listPromptVersions(id: string): Promise<number[]> {
    if (!this.prompts[id]) return [];
    return Object.keys(this.prompts[id]).map(Number).sort((a, b) => a - b);
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

  public async getPrompt(idOrName: string, version?: number): Promise<Prompt | null> {
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

  public async updatePrompt(idOrName: string, version: number, prompt: Prompt): Promise<Prompt> {
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

  public async deletePrompt(idOrName: string, version?: number): Promise<void> {
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

  public async listPrompts(options?: ListPromptsOptions, allVersions = false): Promise<Prompt[]> {
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

  /**
   * Expects a 'sequences' table with columns:
   * id (text, primary key), name (text), description (text), prompt_ids (text[]), created_at (timestamp), updated_at (timestamp), metadata (jsonb)
   */
  public async getSequence(id: string): Promise<PromptSequence | null> {
    const res = await this.pool.query('SELECT * FROM sequences WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      promptIds: row.prompt_ids,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata,
    };
  }

  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    const now = new Date();
    await this.pool.query(
      `INSERT INTO sequences (id, name, description, prompt_ids, created_at, updated_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         prompt_ids = EXCLUDED.prompt_ids,
         updated_at = EXCLUDED.updated_at,
         metadata = EXCLUDED.metadata`,
      [
        sequence.id,
        sequence.name,
        sequence.description,
        sequence.promptIds,
        sequence.createdAt ?? now,
        now,
        sequence.metadata ?? {},
      ],
    );
    return this.getSequence(sequence.id) as Promise<PromptSequence>;
  }

  public async deleteSequence(id: string): Promise<void> {
    await this.pool.query('DELETE FROM sequences WHERE id = $1', [id]);
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

  /**
   * Returns current connection pool metrics: active, idle, waiting, total
   */
  public getPoolMetrics(): { total: number; idle: number; waiting: number; active: number } {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      active: this.pool.totalCount - this.pool.idleCount,
    };
  }

  public async listPromptVersions(id: string): Promise<number[]> {
    const client = await this.pool.connect();
    try {
      const res = await client.query('SELECT version FROM prompts WHERE id = $1 ORDER BY version ASC', [id]);
      return res.rows.map((row: any) => Number(row.version));
    } finally {
      client.release();
    }
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
