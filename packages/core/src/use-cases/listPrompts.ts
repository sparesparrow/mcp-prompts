// Use-case: listPrompts
import { Prompt } from '@sparesparrow/mcp-prompts-contracts';
import { IPromptRepository } from '../ports/IPromptRepository';

export async function listPrompts(repo: IPromptRepository): Promise<Prompt[]> {
  return repo.list();
}
