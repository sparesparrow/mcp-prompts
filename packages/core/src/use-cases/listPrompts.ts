// Use-case: listPrompts
import { Prompt, ListPromptsOptions } from '@sparesparrow/mcp-prompts-contracts';
import { IPromptRepository } from '../ports/IPromptRepository';

export async function listPrompts(repo: IPromptRepository, options?: ListPromptsOptions, allVersions?: boolean): Promise<Prompt[]> {
  return repo.listPrompts(options, allVersions);
}
