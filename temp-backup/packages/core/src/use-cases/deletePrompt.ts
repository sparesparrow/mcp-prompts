// Use-case: deletePrompt
import { IPromptRepository } from '../ports/IPromptRepository';

export async function deletePrompt(repo: IPromptRepository, id: string, version?: number): Promise<boolean> {
  return repo.deletePrompt(id, version);
}
