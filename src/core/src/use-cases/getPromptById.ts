// Use-case: getPromptById
import { Prompt } from '../entities/Prompt';
import { IPromptRepository } from '../ports/IPromptRepository';
import { PromptId } from '../value-objects/PromptId';

export async function getPromptById(repo: IPromptRepository, id: PromptId): Promise<Prompt | null> {
  return repo.getById(id);
}
