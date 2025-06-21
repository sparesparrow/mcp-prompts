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

  public constructor(options: { promptsDir: string }) {
    this.promptsDir = options.promptsDir;
    this.sequencesDir = path.join(options.promptsDir, 'sequences');
    this.workflowStatesDir = path.join(options.promptsDir, 'workflow-states');
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
            promptSchemas.full.parse(prompt);
          } catch (error: unknown) {
            if (error instanceof z.ZodError) {
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

    const parsedData = promptSchemas.create.parse(promptData);
    const id = this.generateId(parsedData.name);

    const versions = await this.listPromptVersions(id);
    const newVersion = versions.length > 0 ? Math.max(...versions) + 1 : 1;

    const promptWithDefaults: Prompt = {
      id,
      version: newVersion,
      ...parsedData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    promptSchemas.full.parse(promptWithDefaults);

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
      return promptSchemas.full.parse(prompt);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        console.warn(`Validation failed for prompt ${id} v${versionToFetch}: ${error.message}`);
        return null;
      }
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

    promptSchemas.full.parse(updatedPrompt);

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

  public async listPrompts(
    options?: ListPromptsOptions,
    allVersions = false,
  ): Promise<{ prompts: Prompt[]; total: number }> {
    if (!this.connected) throw new Error('File storage not connected');
    const allFiles = await fsp.readdir(this.promptsDir);
    const promptFiles = allFiles.filter(f => f.endsWith('.json'));
    const prompts: Prompt[] = [];

    for (const file of promptFiles) {
      try {
        const content = await fsp.readFile(path.join(this.promptsDir, file), 'utf-8');
        const data = JSON.parse(content);
        const prompt = promptSchemas.full.parse(data);
        prompts.push(prompt);
      } catch (error) {
        // Log warnings for malformed or invalid files, then ignore
        if (error instanceof z.ZodError) {
          console.warn(`Skipping invalid prompt file ${file}: ${error.message}`);
        } else if (error instanceof Error) {
          console.warn(`Skipping malformed JSON file ${file}: ${error.message}`);
        }
      }
    }

    let filtered = prompts;

    if (options?.isTemplate !== undefined) {
      filtered = filtered.filter(p => p.isTemplate === options.isTemplate);
    }

    if (allVersions) {
      return { prompts: filtered, total: filtered.length };
    }

    const latestVersionsMap = new Map<string, Prompt>();
    for (const p of filtered) {
      const existing = latestVersionsMap.get(p.id);
      if (!existing || p.version > existing.version) {
        latestVersionsMap.set(p.id, p);
      }
    }
    filtered = Array.from(latestVersionsMap.values());

    // Apply sorting
    if (options?.sort) {
      filtered.sort((a, b) => {
        const aVal = a[options.sort!];
        const bVal = b[options.sort!];
        if (aVal < bVal) return options.order === 'desc' ? 1 : -1;
        if (aVal > bVal) return options.order === 'desc' ? -1 : 1;
        return 0;
      });
    }

    const total = filtered.length;

    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 20;
    const paginated = filtered.slice(offset, offset + limit);

    return { prompts: paginated, total };
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
 * Stores prompts in memory. Useful for testing and development.
 */
export class MemoryAdapter implements StorageAdapter {
  private prompts = new Map<string, Map<number, Prompt>>();
  private sequences = new Map<string, PromptSequence>();
  private workflowStates = new Map<string, WorkflowExecutionState>();
  private connected = false;

  public constructor() {
    // No-op
  }

  public async connect(): Promise<void> {
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
  }

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  public async healthCheck(): Promise<boolean> {
    return this.isConnected();
  }

  public async clearAll(): Promise<void> {
    this.prompts.clear();
    this.sequences.clear();
    this.workflowStates.clear();
  }

  public async listPrompts(options?: ListPromptsOptions, allVersions = false): Promise<Prompt[]> {
    if (!this.connected) throw new Error('Memory storage not connected');

    let promptsToFilter: Prompt[];

    if (allVersions) {
      const allPrompts: Prompt[] = [];
      for (const versionMap of this.prompts.values()) {
        for (const prompt of versionMap.values()) {
          allPrompts.push(prompt);
        }
      }
      promptsToFilter = allPrompts;
    } else {
      // Get the latest version of each prompt
      const latestPrompts: Prompt[] = [];
      for (const versionMap of this.prompts.values()) {
        if (versionMap.size === 0) continue;
        let latestVersion = 0;
        let latestPrompt: Prompt | undefined;
        for (const [version, prompt] of versionMap.entries()) {
          if (version > latestVersion) {
            latestVersion = version;
            latestPrompt = prompt;
          }
        }
        if (latestPrompt) {
          latestPrompts.push(latestPrompt);
        }
      }
      promptsToFilter = latestPrompts;
    }

    let filteredPrompts = promptsToFilter;

    // Apply filtering
    if (options) {
      if (options.tags) {
        const tags = Array.isArray(options.tags) ? options.tags : [options.tags];
        if (tags.length > 0) {
          filteredPrompts = filteredPrompts.filter(p => p.tags && tags.every(t => p.tags!.includes(t)));
        }
      }
      if (options.isTemplate !== undefined) {
        filteredPrompts = filteredPrompts.filter(p => p.isTemplate === options.isTemplate);
      }
      if (options.category) {
        filteredPrompts = filteredPrompts.filter(p => p.category === options.category);
      }
    }

    return filteredPrompts.sort((a, b) => a.name.localeCompare(b.name));
  }

  public async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    if (!this.connected) throw new Error('Memory storage not connected');
    const versionMap = this.prompts.get(id);
    if (!versionMap) return null;

    if (version !== undefined) {
      return versionMap.get(version) ?? null;
    }

    // If no version is specified, return the latest version
    if (versionMap.size === 0) return null;
    const latestVersion = Math.max(...versionMap.keys());
    return versionMap.get(latestVersion) ?? null;
  }

  public async getPromptByName(name: string): Promise<Prompt | null> {
    for (const versionMap of this.prompts.values()) {
      for (const prompt of versionMap.values()) {
        if (prompt.name === name) {
          // This logic might need refinement if names aren't unique.
          // For now, return the first match.
          return prompt;
        }
      }
    }
    return null;
  }

  public async createPrompt(promptData: Prompt): Promise<Prompt> {
    if (!this.connected) throw new Error('Memory storage not connected');
    if (!this.prompts.has(promptData.id)) {
      this.prompts.set(promptData.id, new Map<number, Prompt>());
    }
    const versionMap = this.prompts.get(promptData.id)!;
    versionMap.set(promptData.version, promptData);
    return promptData;
  }

  public async updatePrompt(promptData: Prompt): Promise<Prompt> {
    // For memory adapter, create and update logic is the same.
    return this.createPrompt(promptData);
  }

  public async deletePrompt(id: string, version?: number): Promise<void> {
    if (!this.connected) throw new Error('Memory storage not connected');
    const versionMap = this.prompts.get(id);
    if (!versionMap) return;

    if (version !== undefined) {
      versionMap.delete(version);
      if (versionMap.size === 0) {
        this.prompts.delete(id);
      }
    } else {
      // If no version is specified, delete all versions for that ID.
      this.prompts.delete(id);
    }
  }

  public async listPromptVersions(id: string): Promise<number[]> {
    if (!this.connected) throw new Error('Memory storage not connected');
    const versionMap = this.prompts.get(id);
    return versionMap ? Array.from(versionMap.keys()).sort((a, b) => a - b) : [];
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    if (!this.connected) throw new Error('Memory storage not connected');
    return this.sequences.get(id) ?? null;
  }

  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    if (!this.connected) throw new Error('Memory storage not connected');
    this.sequences.set(sequence.id, sequence);
    return sequence;
  }

  public async deleteSequence(id: string): Promise<void> {
    if (!this.connected) throw new Error('Memory storage not connected');
    this.sequences.delete(id);
  }

  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    if (!this.connected) throw new Error('Memory storage not connected');
    this.workflowStates.set(state.executionId, state);
  }

  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    if (!this.connected) throw new Error('Memory storage not connected');
    return this.workflowStates.get(executionId) ?? null;
  }

  public async listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]> {
    if (!this.connected) throw new Error('Memory storage not connected');
    const allStates = Array.from(this.workflowStates.values());
    return allStates.filter(state => state.workflowId === workflowId);
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
    promptSchemas.full.parse(updatedPromptData);

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