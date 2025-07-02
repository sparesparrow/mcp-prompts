import type { IPromptRepository } from '../ports/IPromptRepository';
import type { Prompt } from '../entities/Prompt';

export async function getPrompt(repo: IPromptRepository, id: string, version?: number): Promise<Prompt | null> {
  return repo.getPrompt(id, version);
}
