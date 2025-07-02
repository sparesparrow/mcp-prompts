import type { Prompt } from '@mcp-prompts/core/src/entities/Prompt';
import type { PromptId } from '@mcp-prompts/core/src/value-objects/PromptId';
import type { IPromptRepository } from '@mcp-prompts/core/src/ports/IPromptRepository';
import type { IPromptApplication } from '@mcp-prompts/core/src/ports/IPromptApplication';
import { addPrompt } from '@mcp-prompts/core/src/use-cases/addPrompt';
import { getPromptById } from '@mcp-prompts/core/src/use-cases/getPromptById';
import { listPrompts } from '@mcp-prompts/core/src/use-cases/listPrompts';
import { updatePrompt } from '@mcp-prompts/core/src/use-cases/updatePrompt';
import { deletePrompt } from '@mcp-prompts/core/src/use-cases/deletePrompt';

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
