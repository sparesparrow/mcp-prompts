// Use-case: listPrompts
import { Prompt } from '../entities/Prompt';
import { IPromptRepository } from '../ports/IPromptRepository';

export async function listPrompts(repo: IPromptRepository): Promise<Prompt[]> {
  return repo.list();
}
