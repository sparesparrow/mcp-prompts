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
import { z } from 'zod';
import { promptSchemas, workflowSchema } from './schemas.js';

export type { StorageAdapter };

export class ValidationError extends Error {
  public issues: z.ZodIssue[];

  public constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

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
            const data = JSON.parse(content);
            promptSchemas.full.parse(data);
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

  public async savePrompt(prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    promptSchemas.full.parse(prompt);

    const finalPath = this.getPromptFileName(prompt.id, prompt.version as number);
    const tempPath = `${finalPath}.tmp`;
    try {
      await fsp.writeFile(tempPath, JSON.stringify(prompt, null, 2));
      await fsp.rename(tempPath, finalPath);
      return prompt;
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
      const data = JSON.parse(content);
      const prompt = promptSchemas.full.parse(data);
      return prompt as Prompt;
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Prompt validation failed for ${id}: ${error.message}`, error.issues);
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

    const newVersion = (await this.listPromptVersions(id)).reduce((max, v) => Math.max(max, v), 0) + 1;

    const updatedData = promptSchemas.update.parse(prompt);

    const updatedPrompt: Prompt = {
      ...existingPrompt,
      ...updatedData,
      id,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

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
        const data = JSON.parse(content);
        prompts.push(promptSchemas.full.parse(data) as Prompt);
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          console.warn(`Skipping malformed prompt file ${file}: ${error.message}`);
        }
        // ignore malformed files for now
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
 * In-memory storage for prompts, useful for testing and development
 */
export class MemoryAdapter implements StorageAdapter {
  private prompts = new Map<string, Map<number, Prompt>>();
  private sequences = new Map<string, PromptSequence>();
  private workflowStates = new Map<string, WorkflowExecutionState>();
  private connected = false;

  public constructor() {
    this.connected = false;
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
    let all: Prompt[] = [];
    for (const versions of this.prompts.values()) {
      for (const prompt of versions.values()) {
        all.push(prompt);
      }
    }

    // Filter
    if (options) {
      all = all.filter(p => {
        if (options.isTemplate !== undefined && p.isTemplate !== options.isTemplate) return false;
        if (options.category && p.category !== options.category) return false;
        if (options.tags) {
          if (!p.tags || !options.tags.every(t => p.tags?.includes(t))) return false;
        }
        if (options.search) {
          const searchTerm = options.search.toLowerCase();
          const inName = p.name.toLowerCase().includes(searchTerm);
          const inContent = p.content.toLowerCase().includes(searchTerm);
          const inDescription = p.description?.toLowerCase().includes(searchTerm);
          if (!inName && !inContent && !inDescription) return false;
        }
        return true;
      });
    }

    // Sort
    if (options?.sort) {
      all.sort((a, b) => {
        const fieldA = a[options.sort as keyof Prompt];
        const fieldB = b[options.sort as keyof Prompt];
        if (fieldA < fieldB) return options.order === 'desc' ? 1 : -1;
        if (fieldA > fieldB) return options.order === 'desc' ? -1 : 1;
        return 0;
      });
    }

    if (!allVersions) {
      const latestVersions = new Map<string, Prompt>();
      for (const p of all) {
        if (!latestVersions.has(p.id) || (latestVersions.get(p.id)?.version ?? 0) < (p.version ?? 0)) {
          latestVersions.set(p.id, p);
        }
      }
      all = Array.from(latestVersions.values());
    }

    // Paginate
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? all.length;
    return all.slice(offset, offset + limit);
  }

  public async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    const versions = this.prompts.get(id);
    if (!versions) {
      return null;
    }

    if (version === undefined) {
      // get latest version
      const latestVersion = Math.max(...versions.keys());
      return versions.get(latestVersion) ?? null;
    }

    return versions.get(version) ?? null;
  }

  public async savePrompt(promptData: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    let versions = this.prompts.get(promptData.id);
    if (!versions) {
      versions = new Map<number, Prompt>();
      this.prompts.set(promptData.id, versions);
    }
    versions.set(promptData.version as number, promptData);
    return promptData;
  }

  public async updatePrompt(id: string, version: number, promptData: Partial<Prompt>): Promise<Prompt> {
    const existing = await this.getPrompt(id, version);
    if (!existing) {
      throw new Error(`Prompt with id ${id} and version ${version} not found`);
    }

    const versions = await this.listPromptVersions(id);
    const newVersion = versions.length > 0 ? Math.max(...versions) + 1 : 1;

    const updatedPrompt: Prompt = {
      ...existing,
      ...promptData,
      id,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    const promptVersions = this.prompts.get(id);
    promptVersions?.set(newVersion, updatedPrompt);

    return updatedPrompt;
  }

  public async deletePrompt(id: string, version?: number): Promise<void> {
    const versions = this.prompts.get(id);
    if (!versions) {
      return;
    }
    if (version !== undefined) {
      versions.delete(version);
      if (versions.size === 0) {
        this.prompts.delete(id);
      }
    } else {
      this.prompts.delete(id);
    }
  }

  public async listPromptVersions(id: string): Promise<number[]> {
    const versions = this.prompts.get(id);
    if (!versions) {
      return [];
    }
    return Array.from(versions.keys()).sort((a, b) => a - b);
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    return this.sequences.get(id) ?? null;
  }

  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    this.sequences.set(sequence.id, sequence);
    return sequence;
  }

  public async deleteSequence(id: string): Promise<void> {
    this.sequences.delete(id);
  }

  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    this.workflowStates.set(state.executionId, state);
  }

  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    return this.workflowStates.get(executionId) ?? null;
  }

  public async listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]> {
    const states: WorkflowExecutionState[] = [];
    for (const state of this.workflowStates.values()) {
      if (state.workflowId === workflowId) {
        states.push(state);
      }
    }
    return states;
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