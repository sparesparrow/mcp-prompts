import type { Prompt } from '../entities/Prompt';
import type { PromptId } from '../value-objects/PromptId';
import type { IPromptRepository } from '../ports/IPromptRepository';

export async function getPromptById(repo: IPromptRepository, id: PromptId): Promise<Prompt | null> {
  return repo.findById(id);
}
