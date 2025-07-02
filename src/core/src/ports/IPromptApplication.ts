// Primary port: IPromptApplication
import { Prompt } from '../entities/Prompt';
import { PromptId } from '../value-objects/PromptId';

export interface IPromptApplication {
  addPrompt(prompt: Prompt): Promise<Prompt>;
  getPromptById(id: PromptId): Promise<Prompt | null>;
  listPrompts(): Promise<Prompt[]>;
  updatePrompt(id: PromptId, update: Partial<Prompt>): Promise<Prompt | null>;
  deletePrompt(id: PromptId): Promise<boolean>;
}
