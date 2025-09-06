import * as fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import lockfile from 'proper-lockfile';
import { z } from 'zod';
import { promptSchemas } from '../../core/src/schemas';
import { LockError } from '../../../src/errors.js';
import type { Prompt, PromptSequence, WorkflowExecutionState, ListPromptsOptions, IPromptRepository, PromptId } from '@sparesparrow/mcp-prompts-core';

export async function atomicWriteFile(filePath: string, data: string) {
  const dir = path.dirname(filePath);
  const tempFile = path.join(dir, `${path.basename(filePath)}.${randomUUID()}.tmp`);
  await fsp.writeFile(tempFile, data);
  const fd = await fsp.open(tempFile, 'r+');
  await fd.sync();
  await fd.close();
  await fsp.rename(tempFile, filePath);
}

function sanitizePromptMetadata<T extends { metadata?: any }>(prompt: T): T {
  if ('metadata' in prompt && prompt.metadata === null) {
    return { ...prompt, metadata: undefined };
  }
  return prompt;
}

export class FileAdapter implements IPromptRepository {
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


  // Helper to read the prompt index (latest version metadata for each prompt)
  private async readPromptIndex(): Promise<Record<string, any>> {
    try {
      const content = await fsp.readFile(this.promptIndexPath, 'utf-8');
      return JSON.parse(content);
    } catch (e: any) {
      if (e.code === 'ENOENT') return {};
      throw e;
    }
  }

  // Helper to write the prompt index
  private async writePromptIndex(index: Record<string, any>): Promise<void> {
    await atomicWriteFile(this.promptIndexPath, JSON.stringify(index, null, 2));
  }

  // Helper to update or add an entry in the index
  private async updatePromptIndexEntry(id: string, metadata: any): Promise<void> {
    const index = await this.readPromptIndex();
    index[id] = metadata;
    await this.writePromptIndex(index);
  }

  // Helper to remove an entry from the index
  private async removePromptIndexEntry(id: string): Promise<void> {
    const index = await this.readPromptIndex();
    if (index[id]) {
      delete index[id];
      await this.writePromptIndex(index);
    }
  }

  private async withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    let release;
    try {
      try {
        // Using a stale timeout to prevent indefinite locks.
        // realpath: false is important because the lock target file may not exist.
        release = await lockfile.lock(filePath, {
          realpath: false,
          retries: 3,
          stale: 20000,
        });
      } catch (error: any) {
        // If locking fails, throw a custom error.
        throw new LockError(
          `Could not acquire lock for ${path.basename(filePath)}: ${error.message}`,
          filePath,
        );
      }
      return await fn();
    } finally {
      // Ensure the lock is always released.
      if (release) {
        await release();
      }
    }
  }

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  public async connect(): Promise<void> {
    try {
      await fsp.mkdir(this.promptsDir, { recursive: true });
      await fsp.mkdir(this.sequencesDir, { recursive: true });
      await fsp.mkdir(this.workflowStatesDir, { recursive: true });

      // Validate existing prompts on startup
      const files = await fsp.readdir(this.promptsDir);
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'index.json') {
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
      // Ensure index.json exists and is valid
      try {
        await this.readPromptIndex();
      } catch (e) {
        // If index is corrupt, reset it
        await this.writePromptIndex({});
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

  public async savePrompt(
    promptData: Omit<Prompt, 'id' | 'version' | 'createdAt' | 'updatedAt'>,
  ): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }

    const parsedData = promptSchemas.create.parse(promptData);
    const id = this.generateId(parsedData.name);
    const idLockPath = path.join(this.promptsDir, `${id}.lock`);

    return this.withLock(idLockPath, async () => {
      const versions = await this.listPromptVersions(id);
      const newVersion = versions.length > 0 ? Math.max(...versions) + 1 : 1;

      const promptWithDefaults: Prompt = {
        id,
        version: newVersion,
        ...parsedData,
        variables: (parsedData.variables as any) ?? undefined,
        tags: parsedData.tags ?? undefined,
        metadata: parsedData.metadata ?? undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      promptSchemas.full.parse(promptWithDefaults);

      const promptFilePath = this.getPromptFileName(id, newVersion);
      await atomicWriteFile(promptFilePath, JSON.stringify(promptWithDefaults, null, 2));

      // Update index with latest version metadata
      await this.updatePromptIndexEntry(id, {
        id: promptWithDefaults.id,
        name: promptWithDefaults.name,
        version: promptWithDefaults.version,
        createdAt: promptWithDefaults.createdAt,
        updatedAt: promptWithDefaults.updatedAt,
        isTemplate: promptWithDefaults.isTemplate,
        description: promptWithDefaults.description,
        category: promptWithDefaults.category,
        tags: promptWithDefaults.tags,
      });

      return sanitizePromptMetadata(promptWithDefaults) as Prompt;
    });
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
      return sanitizePromptMetadata(promptSchemas.full.parse(prompt) as Prompt);
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
    const filePath = this.getPromptFileName(id, version);
    const idLockPath = path.join(this.promptsDir, `${id}.lock`);
    return this.withLock(idLockPath, async () => {
      let existing: Prompt;
      try {
        existing = JSON.parse(await fsp.readFile(filePath, 'utf-8'));
      } catch {
        throw new Error(`Prompt ${id} v${version} not found`);
      }
      const updated: Prompt = {
        ...existing,
        ...prompt,
        updatedAt: new Date().toISOString(),
      };
      promptSchemas.full.parse(updated);
      await atomicWriteFile(filePath, JSON.stringify(updated, null, 2));

      // If this is the latest version, update the index
      const versions = await this.listPromptVersions(id);
      if (version === Math.max(...versions)) {
        await this.updatePromptIndexEntry(id, {
          id: updated.id,
          name: updated.name,
          version: updated.version,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          isTemplate: updated.isTemplate,
          description: updated.description,
          category: updated.category,
          tags: updated.tags,
        });
      }

      return sanitizePromptMetadata(updated);
    });
  }

  public async deletePrompt(id: string, version?: number): Promise<boolean> {
    if (!this.connected) throw new Error('File storage not connected');
    const idLockPath = path.join(this.promptsDir, `${id}.lock`);
    return this.withLock(idLockPath, async () => {
      if (version) {
        const filePath = this.getPromptFileName(id, version);
        try {
          await fsp.unlink(filePath);
          // If this was the latest version, update the index
          const versions = await this.listPromptVersions(id);
          if (versions.length === 0) {
            // No versions left, remove from index
            await this.removePromptIndexEntry(id);
          } else if (version === Math.max(...versions, version)) {
            // Deleted the latest, update index to new latest
            const latestVersion = Math.max(...versions);
            const latestPrompt = await this.getPrompt(id, latestVersion);
            if (latestPrompt) {
              await this.updatePromptIndexEntry(id, {
                id: latestPrompt.id,
                name: latestPrompt.name,
                version: latestPrompt.version,
                createdAt: latestPrompt.createdAt,
                updatedAt: latestPrompt.updatedAt,
                isTemplate: latestPrompt.isTemplate,
                description: latestPrompt.description,
                category: latestPrompt.category,
                tags: latestPrompt.tags,
              });
            }
          }
          return true;
        } catch {
          return false;
        }
      } else {
        // Delete all versions
        const versions = await this.listPromptVersions(id);
        let deleted = false;
        for (const v of versions) {
          const filePath = this.getPromptFileName(id, v);
          try {
            await fsp.unlink(filePath);
            deleted = true;
          } catch {}
        }
        await this.removePromptIndexEntry(id);
        return deleted;
      }
    });
  }

  public async listPrompts(options?: ListPromptsOptions, allVersions = false): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error('File storage not connected');
    }
    if (allVersions) {
      // Fallback to old behavior for allVersions (full scan)
      const allPromptFiles = await fsp.readdir(this.promptsDir);
      let prompts: Prompt[] = [];
      for (const file of allPromptFiles) {
        if (file.endsWith('.json') && file !== 'index.json') {
          const filePath = path.join(this.promptsDir, file);
          try {
            const content = await fsp.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            const validation = promptSchemas.full.safeParse(data);
            if (validation.success) {
              prompts.push(validation.data as Prompt);
            }
          } catch (e) {
            // Ignore malformed files
          }
        }
      }
      return prompts;
    }
    // Use index for latest version only
    const index = await this.readPromptIndex();
    let prompts: Prompt[] = Object.values(index).map((meta: any) => ({
      ...meta,
      content: '', // content will be loaded only if needed
    }));
    // Filtering (except content search)
    if (options) {
      if (options.isTemplate !== undefined) {
        prompts = prompts.filter(p => p.isTemplate === options.isTemplate);
      }
      if (options.category) {
        prompts = prompts.filter(p => p.category === options.category);
      }
      if (options.tags && options.tags.length > 0) {
        prompts = prompts.filter(p => options.tags?.every((tag: string) => p.tags?.includes(tag)));
      }
      if (options.search) {
        const search = options.search.toLowerCase();
        // First filter by name/description
        let filtered = prompts.filter(
          p =>
            p.name.toLowerCase().includes(search) ||
            (p.description?.toLowerCase().includes(search))
        );
        // For others, load full prompt file and check content
        const missing = prompts.filter(
          p =>
            !p.name.toLowerCase().includes(search) &&
            !(p.description?.toLowerCase().includes(search))
        );
        for (const p of missing) {
          try {
            const fullPrompt = await this.getPrompt(p.id, p.version);
            if (fullPrompt && fullPrompt.content.toLowerCase().includes(search)) {
              filtered.push(fullPrompt);
            }
          } catch {}
        }
        prompts = filtered;
      }
    }
    // Sorting
    if (options?.sort) {
      prompts.sort((a, b) => {
        const fieldA = a[options.sort as keyof Prompt] as any;
        const fieldB = b[options.sort as keyof Prompt] as any;
        if (fieldA < fieldB) return options.order === 'desc' ? 1 : -1;
        if (fieldA > fieldB) return options.order === 'desc' ? -1 : 1;
        return 0;
      });
    }
    return prompts.map(p => sanitizePromptMetadata(p));
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    const sequencePath = path.join(this.sequencesDir, `${id}.json`);
    try {
      const content = await fsp.readFile(sequencePath, 'utf-8');
      return workflowSchema.parse(JSON.parse(content)) as unknown as PromptSequence;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    const sequencePath = path.join(this.sequencesDir, `${sequence.id}.json`);
    await this.withLock(sequencePath, () =>
      atomicWriteFile(sequencePath, JSON.stringify(sequence, null, 2)),
    );
    return sequence;
  }

  public async deleteSequence(id: string): Promise<void> {
    const sequencePath = path.join(this.sequencesDir, `${id}.json`);
    try {
      await this.withLock(sequencePath, () => fsp.unlink(sequencePath));
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    const statePath = path.join(this.workflowStatesDir, `${state.executionId}.json`);
    await this.withLock(statePath, () =>
      atomicWriteFile(statePath, JSON.stringify(state, null, 2)),
    );
  }

  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    const statePath = path.join(this.workflowStatesDir, `${executionId}.json`);
    try {
      const content = await fsp.readFile(statePath, 'utf-8');
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

  async add(prompt: Prompt): Promise<Prompt> {
    return Promise.reject(new Error('Not implemented'));
  }

  async getById(id: PromptId): Promise<Prompt | null> {
    return Promise.reject(new Error('Not implemented'));
  }

  async list(): Promise<Prompt[]> {
    return Promise.reject(new Error('Not implemented'));
  }

  async update(id: PromptId, update: Partial<Prompt>): Promise<Prompt | null> {
    return Promise.reject(new Error('Not implemented'));
  }

  async delete(id: PromptId): Promise<boolean> {
    return Promise.reject(new Error('Not implemented'));
  }
} 