import type { Prompt } from '@mcp-prompts/core';
import type { PromptId } from '@mcp-prompts/core';
import type { IPromptRepository } from '@mcp-prompts/core';
import type { IPromptApplication } from '@mcp-prompts/core';
import { addPrompt, getPromptById, listPrompts, updatePrompt, deletePrompt } from '@mcp-prompts/core';

export class PromptApplication implements IPromptApplication {
  constructor(private repo: IPromptRepository) {}

  async addPrompt(prompt: Prompt) {
    return addPrompt(this.repo, prompt);
  }
  async getPromptById(id: PromptId) {
    return getPromptById(this.repo, id);
  }
  async listPrompts() {
    return listPrompts(this.repo);
  }
  async updatePrompt(id: PromptId, update: Partial<Prompt>) {
    await updatePrompt(this.repo, id, update);
    return this.getPromptById(id);
  }
  async deletePrompt(id: PromptId) {
    return deletePrompt(this.repo, id);
  }
  async applyTemplate() {
    throw new Error('Not implemented');
  }
  async validatePrompt() {
    throw new Error('Not implemented');
  }
}
