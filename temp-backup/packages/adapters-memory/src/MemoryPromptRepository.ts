// Jednoduchá paměťová implementace IPromptRepository
import type { IPromptRepository, Prompt, PromptId } from '@sparesparrow/mcp-prompts-core';

export class MemoryPromptRepository implements IPromptRepository {
  private prompts = new Map<PromptId, Prompt>();

  async add(prompt: Prompt): Promise<Prompt> {
    this.prompts.set(prompt.id, prompt);
    return prompt;
  }

  async getById(id: PromptId): Promise<Prompt | null> {
    return this.prompts.get(id) ?? null;
  }

  async list(): Promise<Prompt[]> {
    return Array.from(this.prompts.values());
  }

  async update(id: PromptId, update: Partial<Prompt>): Promise<Prompt | null> {
    const existing = this.prompts.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...update, updatedAt: new Date().toISOString() };
    this.prompts.set(id, updated);
    return updated;
  }

  async delete(id: PromptId): Promise<boolean> {
    return this.prompts.delete(id);
  }

  reset() {
    this.prompts.clear();
  }
}
