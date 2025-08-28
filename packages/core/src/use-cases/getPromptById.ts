// Use-case: getPromptById
import { Prompt } from '@sparesparrow/mcp-prompts-contracts';
import { IPromptRepository } from '../ports/IPromptRepository';

export async function getPromptById(repo: IPromptRepository, id: string, version?: number): Promise<Prompt | null> {
  return repo.getPrompt(id, version);
}
