import type { Prompt } from '../entities/Prompt';
import type { PromptId } from '../value-objects/PromptId';

export interface IPromptRepository {
  save(prompt: Prompt): Promise<void>;
  findById(id: PromptId): Promise<Prompt | null>;
  findAll(): Promise<Prompt[]>;
  update(id: PromptId, update: Partial<Prompt>): Promise<void>;
  delete(id: PromptId): Promise<void>;
}
