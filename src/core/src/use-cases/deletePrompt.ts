// Use-case: deletePrompt
import { IPromptRepository } from '../ports/IPromptRepository';
import { PromptId } from '../value-objects/PromptId';

export async function deletePrompt(repo: IPromptRepository, id: PromptId): Promise<boolean> {
  return repo.delete(id);
}
