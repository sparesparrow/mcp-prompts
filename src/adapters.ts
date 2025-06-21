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
import { z } from 'zod';
import { promptSchemas, workflowSchema } from './schemas.js';

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

  public constructor(promptsDir: string) {
    this.promptsDir = promptsDir;
    this.sequencesDir = path.join(promptsDir, 'sequences');
    this.workflowStatesDir = path.join(promptsDir, 'workflow-states');
  }

  public async connect(): Promise<void> {
    try {
      await fsp.mkdir(this.promptsDir, { recursive: true });
      await fsp.mkdir(this.sequencesDir, { recursive: true });
      await fsp.mkdir(this.workflowStatesDir, { recursive: true });

      // Validate existing prompts on startup
      const files = await fsp.readdir(this.promptsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.promptsDir, file);
          try {
            const content = await fsp.readFile(filePath, 'utf-8');
            const prompt = JSON.parse(content);
            validatePrompt(prompt, 'full', true);
          } catch (error: unknown) {
            if (error instanceof ValidationError) {
              console.warn(`Validation failed for ${file}: ${error.message}`);
            } else {
              console.error(`Error reading or parsing ${file}:`, error);
            }
          }
        }
      }
      this.connected = true;
    } catch (error: unknown) {
      console.error('Error connecting to file storage:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to connect to file storage: ${error.message}`);
      }
      throw new Error('Failed to connect to file storage');
    }
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
  }

  private getPromptFileName(id: string, version: number): string {
    return path.join(this.promptsDir, `${id}-v${version}.json`);
  }

  private generateId(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-');
  }

  public async savePrompt(promptData: Omit<Prompt, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    const id = this.generateId(promptData.name);

    const versions = await this.listPromptVersions(id);
    const newVersion = versions.length > 0 ? Math.max(...versions) + 1 : 1;

    const promptWithDefaults: Prompt = {
      id,
      version: newVersion,
      ...promptSchemas.create.parse(promptData),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    validatePrompt(promptWithDefaults, 'full', true);

    const finalPath = this.getPromptFileName(id, newVersion);
    const tempPath = `${finalPath}.tmp`;
    try {
      await fsp.writeFile(tempPath, JSON.stringify(promptWithDefaults, null, 2));
      await fsp.rename(tempPath, finalPath);
      return promptWithDefaults;
    } catch (error: unknown) {
      try {
        await fsp.unlink(tempPath);
      } catch {
        // ignore
      }
      throw error;
    }
  }

  public async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    if (!this.connected) throw new Error('File storage not connected');

    let versionToFetch = version;

    if (versionToFetch === undefined) {
      const versions = await this.listPromptVersions(id);
      if (versions.length === 0) return null;
      versionToFetch = Math.max(...versions);
    }

    try {
      const content = await fsp.readFile(this.getPromptFileName(id, versionToFetch), 'utf-8');
      const prompt: Prompt = JSON.parse(content);
      validatePrompt(prompt, 'full', true);
      return prompt;
    } catch (error: unknown) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  public async listPromptVersions(id: string): Promise<number[]> {
    if (!this.connected) throw new Error('File storage not connected');
    const files = (await fsp.readdir(this.promptsDir)).filter(f => f.startsWith(`${id}-v`) && f.endsWith('.json'));
    return files
      .map(f => {
        const match = f.match(/-v(\d+)\.json$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
  }

  public async updatePrompt(id: string, version: number, prompt: Partial<Prompt>): Promise<Prompt> {
    if (!this.connected) throw new Error('File storage not connected');

    const existingPrompt = await this.getPrompt(id, version);
    if (!existingPrompt) {
      throw new Error(`Prompt with id ${id} and version ${version} not found`);
    }

    const newVersion = existingPrompt.version + 1;

    const updatedPrompt: Prompt = {
      ...existingPrompt,
      ...prompt,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    validatePrompt(updatedPrompt, 'full', true);

    const finalPath = this.getPromptFileName(id, newVersion);
    const tempPath = `${finalPath}.tmp`;
    try {
      await fsp.writeFile(tempPath, JSON.stringify(updatedPrompt, null, 2));
      await fsp.rename(tempPath, finalPath);
      return updatedPrompt;
    } catch (error: unknown) {
      try {
        await fsp.unlink(tempPath);
      } catch {
        // ignore
      }
      throw error;
    }
  }

  public async deletePrompt(id: string, version?: number): Promise<void> {
    if (!this.connected) throw new Error('File storage not connected');
    if (version !== undefined) {
      try {
        await fsp.unlink(this.getPromptFileName(id, version));
      } catch (error: unknown) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') return; // Not found is ok
        throw error;
      }
      return;
    }
    const allVersions = await this.listPromptVersions(id);
    for (const v of allVersions) {
      try {
        await fsp.unlink(this.getPromptFileName(id, v));
      } catch (error: unknown) {
        // Only ignore 'file not found' errors. Re-throw others.
        if (error instanceof Error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  public async listPrompts(options?: ListPromptsOptions, allVersions = false): Promise<Prompt[]> {
    if (!this.connected) throw new Error('File storage not connected');
    const allFiles = await fsp.readdir(this.promptsDir);
    const promptFiles = allFiles.filter(f => f.endsWith('.json'));
    const prompts: Prompt[] = [];

    for (const file of promptFiles) {
      try {
        const content = await fsp.readFile(path.join(this.promptsDir, file), 'utf-8');
        prompts.push(JSON.parse(content));
      } catch {
        // ignore malformed files
      }
    }

    let filtered = prompts;

    if (options?.isTemplate !== undefined) {
      filtered = filtered.filter(p => p.isTemplate === options.isTemplate);
    }

    if (allVersions) {
      return filtered;
    }

    const latestPrompts = new Map<string, Prompt>();
    for (const prompt of filtered) {
      const existing = latestPrompts.get(prompt.id);
      if (!existing || prompt.version > existing.version) {
        latestPrompts.set(prompt.id, prompt);
      }
    }
    return Array.from(latestPrompts.values());
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
      throw error;
    }
  }

  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }
    const finalPath = path.join(this.sequencesDir, `${sequence.id}.json`);
    await fsp.writeFile(finalPath, JSON.stringify(sequence, null, 2));
    return sequence;
  }

  public async deleteSequence(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }
    try {
      await fsp.unlink(path.join(this.sequencesDir, `${id}.json`));
    } catch (error: unknown) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }

  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    const finalPath = path.join(this.workflowStatesDir, `${state.executionId}.json`);
    await fsp.writeFile(finalPath, JSON.stringify(state, null, 2));
  }

  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    try {
      const content = await fsp.readFile(path.join(this.workflowStatesDir, `${executionId}.json`), 'utf-8');
      const state: WorkflowExecutionState = JSON.parse(content);
      workflowSchema.parse(state);
      return state;
    } catch (error: unknown) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  public async listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]> {
    const states: WorkflowExecutionState[] = [];
    const files = await fsp.readdir(this.workflowStatesDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fsp.readFile(path.join(this.workflowStatesDir, file), 'utf-8');
        const state: WorkflowExecutionState = JSON.parse(content);
        if (state.workflowId === workflowId) {
          states.push(state);
        }
      }
    }
    return states;
  }

  public async healthCheck(): Promise<boolean> {
    return this.connected;
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

  public async updatePrompt(id: string, version: number, prompt: Partial<Prompt>): Promise<Prompt> {
    if (!this.connected) throw new Error('File storage not connected');

    const existingPrompt = await this.getPrompt(id, version);
    if (!existingPrompt) {
      throw new Error(`Prompt with id ${id} and version ${version} not found`);
    }

    // Merge the existing prompt with the update payload
    const updatedPromptData = {
      ...existingPrompt,
      ...prompt,
      version: existingPrompt.version, // Ensure version isn't changed by partial update
      updatedAt: new Date().toISOString(),
    };

    // Validate the final, merged object against the full schema
    validatePrompt(updatedPromptData, 'full', true);

    const finalPath = this.getPromptFileName(id, version);
    const tempPath = `${finalPath}.tmp`;
    try {
      await fsp.writeFile(tempPath, JSON.stringify(updatedPromptData, null, 2));
      await fsp.rename(tempPath, finalPath);
      return updatedPromptData;
    } catch (error: unknown) {
      try {
        await fsp.unlink(tempPath);
      } catch {
        // ignore
      }
      throw error;
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

    if (!allVersions) {
      if (whereClauses.length > 0) {
        query += ` AND`;
      } else {
        query += ` WHERE`;
      }
      query += ` (p.id, p.version) IN (
        SELECT id, MAX(version)
        FROM prompts
        GROUP BY id
      )`;
    }

    query += ' ORDER BY p.name';

    if (options?.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }
    if (options?.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const res = await this.pool.query(query, params);
    return Promise.all(res.rows.map(p => this.getPromptById(p.id)));
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    const res = await this.pool.query('SELECT * FROM sequences WHERE id = $1', [id]);
    return res.rows[0] || null;
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