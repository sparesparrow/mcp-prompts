import type { Prompt } from '@mcp-prompts/core/src/entities/Prompt';
import type { PromptId } from '@mcp-prompts/core/src/value-objects/PromptId';
import type { IPromptRepository } from '@mcp-prompts/core/src/ports/IPromptRepository';

export class MemoryPromptRepository implements IPromptRepository {
  private prompts = new Map<string, Prompt>();

  async save(prompt: Prompt): Promise<void> {
    this.prompts.set(prompt.id, prompt);
  }

  async findById(id: PromptId): Promise<Prompt | null> {
    return this.prompts.get(id.toString()) || null;
  }

  async findAll(): Promise<Prompt[]> {
    return Array.from(this.prompts.values());
  }

  async update(id: PromptId, update: Partial<Prompt>): Promise<void> {
    const prompt = this.prompts.get(id.toString());
    if (!prompt) throw new Error('Prompt not found');
    this.prompts.set(id.toString(), { ...prompt, ...update });
  }

  async delete(id: PromptId): Promise<void> {
    this.prompts.delete(id.toString());
  }

  // Pro testy: resetuje stav
  reset() {
    this.prompts.clear();
  }
}
