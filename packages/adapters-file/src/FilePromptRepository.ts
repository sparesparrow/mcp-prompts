import { promises as fs } from 'fs';
import pathe from 'pathe';
import type { Prompt } from '@mcp-prompts/core/src/entities/Prompt';
import type { PromptId } from '@mcp-prompts/core/src/value-objects/PromptId';
import type { IPromptRepository } from '@mcp-prompts/core/src/ports/IPromptRepository';

const DEFAULT_PATH = pathe.resolve(process.env.PROMPT_FILE_PATH || './data/prompts.json');

export class FilePromptRepository implements IPromptRepository {
  private filePath: string;

  constructor(filePath: string = DEFAULT_PATH) {
    this.filePath = filePath;
  }

  private async readAll(): Promise<Prompt[]> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data) as Prompt[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  private async writeAll(prompts: Prompt[]): Promise<void> {
    await fs.mkdir(pathe.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(prompts, null, 2), 'utf-8');
  }

  async save(prompt: Prompt): Promise<void> {
    const prompts = await this.readAll();
    const idx = prompts.findIndex(p => p.id === prompt.id);
    if (idx >= 0) prompts[idx] = prompt;
    else prompts.push(prompt);
    await this.writeAll(prompts);
  }

  async findById(id: PromptId): Promise<Prompt | null> {
    const prompts = await this.readAll();
    return prompts.find(p => p.id === id.toString()) || null;
  }

  async findAll(): Promise<Prompt[]> {
    return this.readAll();
  }

  async update(id: PromptId, update: Partial<Prompt>): Promise<void> {
    const prompts = await this.readAll();
    const idx = prompts.findIndex(p => p.id === id.toString());
    if (idx < 0) throw new Error('Prompt not found');
    prompts[idx] = { ...prompts[idx], ...update };
    await this.writeAll(prompts);
  }

  async delete(id: PromptId): Promise<void> {
    const prompts = await this.readAll();
    const filtered = prompts.filter(p => p.id !== id.toString());
    await this.writeAll(filtered);
  }
}
