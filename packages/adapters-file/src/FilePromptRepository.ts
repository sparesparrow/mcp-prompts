// Souborová implementace IPromptRepository
import type { IPromptRepository, Prompt, PromptId } from '@sparesparrow/mcp-prompts-core';
import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_FILE = path.resolve(process.env.PROMPT_FILE_PATH || './prompts.json');

export class FilePromptRepository implements IPromptRepository {
  private async readAll(): Promise<Prompt[]> {
    try {
      const data = await fs.readFile(DATA_FILE, 'utf-8');
      return JSON.parse(data) as Prompt[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  private async writeAll(prompts: Prompt[]): Promise<void> {
    await fs.writeFile(DATA_FILE, JSON.stringify(prompts, null, 2), 'utf-8');
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
