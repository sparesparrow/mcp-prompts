/**
 * Consolidated Adapters Module
 * Contains all storage adapters in a single file
 */

import fs from 'fs';
import * as fsp from 'fs/promises';
import path from 'path';
import pg from 'pg';
import type { pino } from 'pino';
import lockfile from 'proper-lockfile';
import { z } from 'zod';

import {
  type ListPromptsOptions,
  type McpConfig,
  type Prompt,
  type PromptSequence,
  type StorageAdapter,
  type WorkflowExecutionState,
} from './interfaces.js';
import { promptSchemas, workflowSchema } from './schemas.js';

class NotImplementedError extends Error {
  constructor(message = 'Method not implemented.') {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export class ValidationError extends Error {
  public issues: z.ZodIssue[];

  public constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/**
 *
 * @param config
 * @param logger
 */
export function adapterFactory(config: McpConfig, logger: pino.Logger): StorageAdapter {
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

class BaseAdapter {
  private getPromptFileName(promptsDir: string, id: string, version: number): string {
    return path.join(promptsDir, `${id}-v${version}.json`);
  }

  protected async _listPrompts(
    promptsDir: string,
    options?: ListPromptsOptions,
    allVersions = false,
  ): Promise<Prompt[]> {
    const allFiles = await fsp.readdir(promptsDir).catch(() => []);
    const promptFiles = allFiles.filter(f => f.endsWith('.json'));
    let prompts: Prompt[] = [];

    for (const file of promptFiles) {
      try {
        const content = await fsp.readFile(path.join(promptsDir, file), 'utf-8');
        const data: unknown = JSON.parse(content);
        prompts.push(promptSchemas.full.parse(data) as Prompt);
      } catch (error) {
        console.warn(`Skipping invalid/malformed prompt file ${file}.`);
      }
    }

    if (options?.isTemplate !== undefined) {
      prompts = prompts.filter(p => p.isTemplate === options.isTemplate);
    }

    if (!allVersions) {
      const latest = new Map<string, Prompt>();
      for (const p of prompts) {
        if (!latest.has(p.id) || (latest.get(p.id)!.version ?? 0) < (p.version ?? 0)) {
          latest.set(p.id, p);
        }
      }
      prompts = Array.from(latest.values());
    }
    return prompts;
  }
}

/**
 * FileAdapter Implementation
 * Stores prompts as individual JSON files in a directory
 */
export class FileAdapter extends BaseAdapter implements StorageAdapter {
  private promptsDir: string;
  private sequencesDir: string;
  private workflowStatesDir: string;
  private connected = false;

  public constructor(options: { promptsDir: string }) {
    super();
    this.promptsDir = options.promptsDir;
    this.sequencesDir = path.join(options.promptsDir, 'sequences');
    this.workflowStatesDir = path.join(options.promptsDir, 'workflow-states');
  }

  public async connect(): Promise<void> {
    try {
      await fsp.mkdir(this.promptsDir, { recursive: true });
      await fsp.mkdir(this.sequencesDir, { recursive: true });
      await fsp.mkdir(this.workflowStatesDir, { recursive: true });
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

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  public async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  public async savePrompt(promptData: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    const finalPrompt = promptSchemas.full.parse(promptData);
    const promptFilePath = this.getPromptFileName(this.promptsDir, finalPrompt.id, finalPrompt.version);

    await fsp.writeFile(promptFilePath, JSON.stringify(finalPrompt, null, 2));
    return finalPrompt;
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
      const content = await fsp.readFile(this.getPromptFileName(this.promptsDir, id, versionToFetch), 'utf-8');
      const prompt: unknown = JSON.parse(content);
      return promptSchemas.full.parse(prompt) as Prompt;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn(`Validation failed for prompt ${id} v${versionToFetch}: ${error.message}`);
      }
      return null;
    }
  }

  public async listPromptVersions(id: string): Promise<number[]> {
    if (!this.connected) throw new Error('File storage not connected');
    const files = (await fsp.readdir(this.promptsDir)).filter(
      f => f.startsWith(`${id}-v`) && f.endsWith('.json'),
    );
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

    const updatedData = promptSchemas.update.parse(prompt);
    const updatedPrompt: Prompt = {
      ...existingPrompt,
      ...updatedData,
      id,
      version,
      updatedAt: new Date().toISOString(),
    };

    const finalPath = this.getPromptFileName(this.promptsDir, id, version);
    await fsp.writeFile(finalPath, JSON.stringify(updatedPrompt, null, 2));
    return updatedPrompt;
  }

  public async deletePrompt(id: string, version?: number): Promise<void> {
    if (!this.connected) throw new Error('File storage not connected');
    if (version !== undefined) {
      await fsp.unlink(this.getPromptFileName(this.promptsDir, id, version)).catch(e => {
        if (e.code !== 'ENOENT') throw e;
      });
      return;
    }
    const allVersions = await this.listPromptVersions(id);
    await Promise.all(
      allVersions.map(v =>
        fsp.unlink(this.getPromptFileName(this.promptsDir, id, v)).catch(e => {
          if (e.code !== 'ENOENT') throw e;
        }),
      ),
    );
  }

  public async listPrompts(
    options?: ListPromptsOptions,
    allVersions = false,
  ): Promise<Prompt[]> {
    return this._listPrompts(this.promptsDir, options, allVersions);
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    throw new NotImplementedError();
  }
  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    throw new NotImplementedError();
  }
  public async deleteSequence(id: string): Promise<void> {
    throw new NotImplementedError();
  }
  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    throw new NotImplementedError();
  }
  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    throw new NotImplementedError();
  }
  public async listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]> {
    throw new NotImplementedError();
  }
}

/**
 * MemoryAdapter Implementation
 */
export class MemoryAdapter implements StorageAdapter {
  private prompts = new Map<string, Map<number, Prompt>>();
  private sequences = new Map<string, PromptSequence>();
  private workflowStates = new Map<string, WorkflowExecutionState>();
  private connected = false;

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

  public async savePrompt(promptData: Prompt): Promise<Prompt> {
    if (!this.connected) throw new Error('Memory storage not connected');
    const data = promptSchemas.full.parse(promptData);
    let versions = this.prompts.get(data.id);
    if (!versions) {
      versions = new Map<number, Prompt>();
      this.prompts.set(data.id, versions);
    }
    versions.set(data.version, data);
    return data;
  }

  public async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    const versions = this.prompts.get(id);
    if (!versions) return null;
    if (version === undefined) {
      const latestVersion = Math.max(...versions.keys());
      return versions.get(latestVersion) ?? null;
    }
    return versions.get(version) ?? null;
  }

  public async listPromptVersions(id: string): Promise<number[]> {
    const versions = this.prompts.get(id);
    return versions ? Array.from(versions.keys()).sort((a, b) => a - b) : [];
  }

  public async updatePrompt(
    id: string,
    version: number,
    promptData: Partial<Prompt>,
  ): Promise<Prompt> {
    const existing = await this.getPrompt(id, version);
    if (!existing) throw new Error(`Prompt not found: ${id} v${version}`);
    const updatedPrompt = { ...existing, ...promptData, updatedAt: new Date().toISOString() };
    const validated = promptSchemas.full.parse(updatedPrompt);
    this.prompts.get(id)?.set(version, validated);
    return validated;
  }

  public async deletePrompt(id: string, version?: number): Promise<void> {
    const versions = this.prompts.get(id);
    if (!versions) return;
    if (version !== undefined) {
      versions.delete(version);
      if (versions.size === 0) {
        this.prompts.delete(id);
      }
    } else {
      this.prompts.delete(id);
    }
  }

  public async listPrompts(
    options?: ListPromptsOptions,
    allVersions = false,
  ): Promise<Prompt[]> {
    let all: Prompt[] = Array.from(this.prompts.values()).flatMap(versions =>
      Array.from(versions.values()),
    );

    if (options?.isTemplate !== undefined) {
      all = all.filter(p => p.isTemplate === options.isTemplate);
    }

    if (!allVersions) {
      const latest = new Map<string, Prompt>();
      for (const p of all) {
        if (!latest.has(p.id) || (latest.get(p.id)!.version ?? 0) < (p.version ?? 0)) {
          latest.set(p.id, p);
        }
      }
      all = Array.from(latest.values());
    }

    // sort and paginate as in FileAdapter
    return all;
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    throw new NotImplementedError();
  }
  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    throw new NotImplementedError();
  }
  public async deleteSequence(id: string): Promise<void> {
    throw new NotImplementedError();
  }
  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    throw new NotImplementedError();
  }
  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    throw new NotImplementedError();
  }
  public async listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]> {
    throw new NotImplementedError();
  }
}

/**
 * PostgresAdapter Implementation
 */
export class PostgresAdapter implements StorageAdapter {
  private pool: pg.Pool;

  public constructor(config: pg.PoolConfig) {
    this.pool = new pg.Pool({ ...config, max: 20 });
  }
  public async connect(): Promise<void> {
    await this.pool.connect();
  }
  public async disconnect(): Promise<void> {
    await this.pool.end();
  }
  public async isConnected(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      client.release();
      return true;
    } catch {
      return false;
    }
  }
  public async healthCheck(): Promise<boolean> {
    return this.isConnected();
  }

  public async savePrompt(prompt: Prompt): Promise<Prompt> {
    throw new NotImplementedError();
  }
  public async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    throw new NotImplementedError();
  }
  public async listPromptVersions(id: string): Promise<number[]> {
    throw new NotImplementedError();
  }
  public async updatePrompt(id: string, version: number, prompt: Partial<Prompt>): Promise<Prompt> {
    throw new NotImplementedError();
  }
  public async deletePrompt(id: string, version?: number): Promise<void> {
    throw new NotImplementedError();
  }
  public async listPrompts(
    options?: ListPromptsOptions,
    allVersions = false,
  ): Promise<Prompt[]> {
    throw new NotImplementedError();
  }
  public async getSequence(id: string): Promise<PromptSequence | null> {
    throw new NotImplementedError();
  }
  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    throw new NotImplementedError();
  }
  public async deleteSequence(id: string): Promise<void> {
    throw new NotImplementedError();
  }
  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    throw new NotImplementedError();
  }
  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    throw new NotImplementedError();
  }
  public async listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]> {
    throw new NotImplementedError();
  }
} 