// Implementace aplikační vrstvy (IPromptApplication)
import { IPromptApplication } from '../ports/IPromptApplication';
import { IPromptRepository } from '../ports/IPromptRepository';
import { Prompt } from '../entities/Prompt';
import { PromptId } from '../value-objects/PromptId';

export class PromptApplication implements IPromptApplication {
  constructor(private readonly repo: IPromptRepository) {}

  async addPrompt(prompt: Prompt): Promise<Prompt> {
    return this.repo.add(prompt);
  }

  async getPromptById(id: PromptId): Promise<Prompt | null> {
    return this.repo.getById(id);
  }

  async listPrompts(): Promise<Prompt[]> {
    return this.repo.list();
  }

  async updatePrompt(id: PromptId, update: Partial<Prompt>): Promise<Prompt | null> {
    return this.repo.update(id, update);
  }

  async deletePrompt(id: PromptId): Promise<boolean> {
    return this.repo.delete(id);
  }
}
