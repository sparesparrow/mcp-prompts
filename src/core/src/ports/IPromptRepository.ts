// Secondary port: IPromptRepository
import { Prompt } from '../entities/Prompt';
import { PromptId } from '../value-objects/PromptId';

export interface IPromptRepository {
  add(prompt: Prompt): Promise<Prompt>;
  getById(id: PromptId): Promise<Prompt | null>;
  list(): Promise<Prompt[]>;
  update(id: PromptId, update: Partial<Prompt>): Promise<Prompt | null>;
  delete(id: PromptId): Promise<boolean>;
}
