/**
 * Consolidated Adapters Module
 * Contains all storage adapters in a single file
 */

import * as fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

import lockfile from 'proper-lockfile';
import type { pino } from 'pino';
import pg from 'pg';
import { z } from 'zod';

import {
  type ListPromptsOptions,
  type McpConfig,
  type Prompt,
  type PromptSequence,
  type IPromptRepository,
  type ISequenceRepository,
  type IWorkflowRepository,
  type WorkflowExecutionState,
} from '../../packages/core/src/interfaces.js';
import { promptSchemas, workflowSchema } from './schemas.js';
import { LockError } from './errors.js';

export async function atomicWriteFile(filePath: string, data: string) {
  const dir = path.dirname(filePath);
  const tempFile = path.join(dir, `${path.basename(filePath)}.${randomUUID()}.tmp`);
  await fsp.writeFile(tempFile, data);
  const fd = await fsp.open(tempFile, 'r+');
  await fd.sync();
  await fd.close();
  await fsp.rename(tempFile, filePath);
}

export function adapterFactory(config: McpConfig, logger: pino.Logger): IPromptRepository {
  const { storage } = config;

  switch (storage.type) {
    case 'file':
      logger.info(`Using file storage adapter with directory: ${storage.promptsDir}`);
      return new FileAdapter({ promptsDir: storage.promptsDir as string });
    case 'memory':
      logger.info('Using memory storage adapter');
      return new MemoryAdapter();
    case 'postgres':
      logger.info(`Using postgres storage adapter with host: ${storage.host}`);
      return new PostgresAdapter({
        database: storage.database,
        host: storage.host,
        max: storage.maxConnections,
        password: storage.password,
        port: storage.port,
        ssl: storage.ssl,
        user: storage.user,
      });
    default:
      throw new Error(`Unknown storage adapter type: ${storage.type}`);
  }
}

export type { IPromptRepository };

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
export class FileAdapter implements IPromptRepository, ISequenceRepository, IWorkflowRepository {
  private promptsDir: string;
  private sequencesDir: string;
  private workflowStatesDir: string;
  private connected = false;
  private promptIndexPath: string;

  public constructor(options: { promptsDir: string }) {
    this.promptsDir = options.promptsDir;
    this.sequencesDir = path.join(options.promptsDir, 'sequences');
    this.workflowStatesDir = path.join(options.promptsDir, 'workflow-states');
    this.promptIndexPath = path.join(this.promptsDir, 'index.json');
  }

}

/**
 * MemoryAdapter Implementation
 * In-memory storage for prompts, useful for testing and development
 */
export class MemoryAdapter implements IPromptRepository, ISequenceRepository, IWorkflowRepository {
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
    return this.connected;
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
        if (fieldA === undefined || fieldB === undefined) return 0;
        if (fieldA < fieldB) return options.order === 'desc' ? 1 : -1;
        if (fieldA > fieldB) return options.order === 'desc' ? -1 : 1;
        return 0;
      });
    }

    if (!allVersions) {
      const latestVersions = new Map<string, Prompt>();
      for (const p of all) {
        if (
          !latestVersions.has(p.id) ||
          (latestVersions.get(p.id)?.version ?? 0) < (p.version ?? 0)
        ) {
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
    return sanitizePromptMetadata(promptData);
  }

  public async updatePrompt(
    id: string,
    version: number,
    promptData: Partial<Prompt>,
  ): Promise<Prompt> {
    const existing = await this.getPrompt(id, version);
    if (!existing) {
      throw new Error(`Prompt with id ${id} and version ${version} not found`);
    }

    const updatedPrompt: Prompt = {
      ...existing,
      ...promptData,
      id,
      version,
      updatedAt: new Date().toISOString(),
    };

    const promptVersions = this.prompts.get(id);
    promptVersions?.set(version, updatedPrompt);

    return sanitizePromptMetadata(updatedPrompt);
  }

  public async deletePrompt(id: string, version?: number): Promise<boolean> {
    const versions = this.prompts.get(id);
    if (!versions) {
      return false;
    }
    if (version !== undefined) {
      if (!versions.has(version)) {
        return false;
      }
      versions.delete(version);
      if (versions.size === 0) {
        this.prompts.delete(id);
      }
    } else {
      this.prompts.delete(id);
    }
    return true;
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
export class PostgresAdapter implements IPromptRepository, ISequenceRepository, IWorkflowRepository {
  private pool: pg.Pool;
  private connected = false;
  private config: pg.PoolConfig;
  private maxRetries = 5;
  private retryDelay = 1000; // 1 second

  public constructor(config: pg.PoolConfig) {
    this.config = {
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
        await this.pool.query(
          'INSERT INTO template_variables (prompt_id, name) VALUES ($1, $2)',
          [promptId, variable],
        );
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

  private extractVariableNames(variables?: (string | { name: string; description?: string; default?: string; required?: boolean; type?: "string" | "number" | "boolean" | "object" | "array"; options?: string[]; })[]): string[] {
    if (!variables) return [];
    return variables.map(v => typeof v === 'string' ? v : v.name);
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

      return sanitizePromptMetadata(await this.getPromptById(promptId));
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

    return sanitizePromptMetadata({
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
    });
  }

  public async getPrompt(idOrName: string, version?: number): Promise<Prompt | null> {
    const isNumericId = /^\d+$/.test(idOrName);
    let queryText: string;
    const queryParams: (string | number)[] = [isNumericId ? parseInt(idOrName, 10) : idOrName];

    if (version !== undefined) {
      queryText = `SELECT id FROM prompts WHERE ${
        isNumericId ? 'id = $1' : 'name = $1'
      } AND version = $2`;
      queryParams.push(version);
    } else {
      queryText = `SELECT id FROM prompts WHERE ${
        isNumericId ? 'id = $1' : 'name = $1'
      } ORDER BY version DESC LIMIT 1`;
    }

    const res = await this.pool.query(queryText, queryParams);
    if (res.rows.length === 0) {
      return null;
    }

    return sanitizePromptMetadata(await this.getPromptById(res.rows[0].id));
  }

  public async updatePrompt(id: string, version: number, prompt: Partial<Prompt>): Promise<Prompt> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const promptResult = await client.query(
        'SELECT id FROM prompts WHERE id = $1 AND version = $2',
        [id, version],
      );

      if (promptResult.rows.length === 0) {
        throw new Error(`Prompt with id ${id} and version ${version} not found`);
      }
      const promptId = promptResult.rows[0].id;

      const updatesToApply = promptSchemas.update.parse(prompt);

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const updateMap: Record<string, any> = {};
      if (updatesToApply.name !== undefined) updateMap.name = updatesToApply.name;
      if (updatesToApply.description !== undefined)
        updateMap.description = updatesToApply.description;
      if (updatesToApply.content !== undefined) updateMap.content = updatesToApply.content;
      if (updatesToApply.isTemplate !== undefined)
        updateMap.is_template = updatesToApply.isTemplate;
      if (updatesToApply.category !== undefined) updateMap.category = updatesToApply.category;
      if (updatesToApply.metadata !== undefined) updateMap.metadata = updatesToApply.metadata;

      for (const [key, value] of Object.entries(updateMap)) {
        setClauses.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }

      setClauses.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());

      if (setClauses.length > 0) {
        values.push(promptId);
        const updateQuery = `UPDATE prompts SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;
        await client.query(updateQuery, values);
      }

      if (updatesToApply.tags) {
        await this.setPromptTags(promptId, updatesToApply.tags);
      }
      if (updatesToApply.variables) {
        await this.setTemplateVariables(
          promptId,
          this.extractVariableNames(updatesToApply.variables as any),
        );
      }

      await client.query('COMMIT');
      return sanitizePromptMetadata(await this.getPromptById(promptId));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async deletePrompt(idOrName: string, version?: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const isNumericId = /^\d+$/.test(idOrName);
      const promptResult = await client.query(
        `SELECT id FROM prompts WHERE ${isNumericId ? 'id = $1' : 'name = $1'}`,
        [isNumericId ? parseInt(idOrName, 10) : idOrName],
      );

      if (promptResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const promptId = promptResult.rows[0].id;
      let deleteRes;

      if (version !== undefined) {
        deleteRes = await client.query('DELETE FROM prompts WHERE id = $1 AND version = $2', [
          promptId,
          version,
        ]);
        const remainingVersionsResult = await client.query(
          'SELECT COUNT(*) as count FROM prompts WHERE id = $1',
          [promptId],
        );
        if (parseInt(remainingVersionsResult.rows[0].count, 10) === 0) {
          await client.query('DELETE FROM prompt_tags WHERE prompt_id = $1', [promptId]);
          await client.query('DELETE FROM template_variables WHERE prompt_id = $1', [promptId]);
        }
      } else {
        await client.query('DELETE FROM prompt_tags WHERE prompt_id = $1', [promptId]);
        await client.query('DELETE FROM template_variables WHERE prompt_id = $1', [promptId]);
        deleteRes = await client.query('DELETE FROM prompts WHERE id = $1', [promptId]);
      }

      await client.query('COMMIT');
      return (deleteRes?.rowCount ?? 0) > 0;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  public async listPrompts(options?: ListPromptsOptions, allVersions = false): Promise<Prompt[]> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT p.id FROM prompts p';
      const whereClauses: string[] = [];
      const params: any[] = [];

      if (options?.search) {
        params.push(`%${options.search}%`);
        whereClauses.push(
          `(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`,
        );
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      if (!allVersions) {
        query = `
          WITH latest_prompts AS (
            SELECT id, MAX(version) as max_version
            FROM prompts
            GROUP BY id
          )
          SELECT p.id FROM prompts p
          JOIN latest_prompts lp ON p.id = lp.id AND p.version = lp.max_version
        `;
      }

      const res = await client.query(query, params);
      return Promise.all(res.rows.map(p => this.getPromptById(p.id)));
    } finally {
      client.release();
    }
  }

  public async listPromptVersions(id: string): Promise<number[]> {
    const res = await this.pool.query(
      'SELECT version FROM prompts WHERE name = $1 ORDER BY version ASC',
      [id],
    );
    return res.rows.map(r => r.version);
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    const res = await this.pool.query('SELECT * FROM sequences WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      return null;
    }
    return res.rows[0];
  }

  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    const { id, name, description, promptIds, createdAt, updatedAt, metadata } = sequence;
    const res = await this.pool.query(
      'INSERT INTO sequences (id, name, description, prompt_ids, created_at, updated_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET name = $2, description = $3, prompt_ids = $4, updated_at = $6, metadata = $7 RETURNING *',
      [id, name, description, promptIds, createdAt, updatedAt, metadata],
    );
    return res.rows[0];
  }

  public async deleteSequence(id: string): Promise<void> {
    await this.pool.query('DELETE FROM sequences WHERE id = $1', [id]);
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  private generateId(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-');
  }

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    const {
      executionId,
      workflowId,
      status,
      currentStepId,
      context,
      createdAt,
      updatedAt,
      history,
    } = state;
    await this.pool.query(
      `INSERT INTO workflow_executions (id, workflow_id, status, context, current_step_id, history, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         status = $3,
         context = $4,
         current_step_id = $5,
         history = $6,
         updated_at = $8`,
      [
        executionId,
        workflowId,
        status,
        context,
        currentStepId,
        JSON.stringify(history),
        createdAt,
        updatedAt,
      ],
    );
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
      version: 0, // Note: version is not in the DB schema for workflow_executions
      status: row.status,
      currentStepId: row.current_step_id,
      context: row.context,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      history: row.history,
    };
  }

  public async listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]> {
    const res = await this.pool.query('SELECT * FROM workflow_executions WHERE workflow_id = $1', [
      workflowId,
    ]);
    return res.rows.map(row => ({
      executionId: row.id,
      workflowId: row.workflow_id,
      version: 0, // Note: version is not in the DB schema for workflow_executions
      status: row.status,
      currentStepId: row.current_step_id,
      context: row.context,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      history: row.history,
    }));
  }
}

function sanitizePromptMetadata<T extends { metadata?: any }>(prompt: T): T {
  if ('metadata' in prompt && prompt.metadata === null) {
    return { ...prompt, metadata: undefined };
  }
  return prompt;
}