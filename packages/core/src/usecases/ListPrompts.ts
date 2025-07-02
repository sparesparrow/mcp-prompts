import type { IPromptRepository } from '../ports/IPromptRepository';
import type { Prompt } from '../entities/Prompt';

export async function listPrompts(repo: IPromptRepository, options?: any, allVersions = false): Promise<Prompt[]> {
  return repo.listPrompts(options, allVersions);
}
