import type { Prompt } from '../entities/Prompt';
import type { PromptId } from '../value-objects/PromptId';

export interface IPromptApplication {
  addPrompt(prompt: Prompt): Promise<Prompt>;
  getPromptById(id: PromptId): Promise<Prompt | null>;
  listPrompts(): Promise<Prompt[]>;
  updatePrompt(id: PromptId, update: Partial<Prompt>): Promise<Prompt>;
  deletePrompt(id: PromptId): Promise<void>;
  applyTemplate(id: PromptId, variables: Record<string, unknown>): Promise<string>;
  validatePrompt(prompt: Prompt): Promise<boolean>;
}
