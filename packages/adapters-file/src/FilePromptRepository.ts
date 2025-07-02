// Souborová implementace IPromptRepository
import { IPromptRepository } from '@core/ports/IPromptRepository';
import { Prompt } from '@core/entities/Prompt';
import { PromptId } from '@core/value-objects/PromptId';
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
    const prompts = await this.readAll();
    prompts.push(prompt);
    await this.writeAll(prompts);
    return prompt;
  }

  async getById(id: PromptId): Promise<Prompt | null> {
    const prompts = await this.readAll();
    return prompts.find(p => p.id === id) ?? null;
  }

  async list(): Promise<Prompt[]> {
    return this.readAll();
  }

  async update(id: PromptId, update: Partial<Prompt>): Promise<Prompt | null> {
    const prompts = await this.readAll();
    const idx = prompts.findIndex(p => p.id === id);
    if (idx === -1) return null;
    const updated = { ...prompts[idx], ...update, updatedAt: new Date() };
    prompts[idx] = updated;
    await this.writeAll(prompts);
    return updated;
  }

  async delete(id: PromptId): Promise<boolean> {
    const prompts = await this.readAll();
    const newPrompts = prompts.filter(p => p.id !== id);
    const changed = newPrompts.length !== prompts.length;
    if (changed) await this.writeAll(newPrompts);
    return changed;
  }
}
