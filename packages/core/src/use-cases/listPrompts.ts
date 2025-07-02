import type { Prompt } from '../entities/Prompt';
import type { IPromptRepository } from '../ports/IPromptRepository';

export async function listPrompts(repo: IPromptRepository): Promise<Prompt[]> {
  return repo.findAll();
}
