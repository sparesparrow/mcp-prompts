// Use-case: updatePrompt
import { Prompt } from '@sparesparrow/mcp-prompts-contracts';
import { IPromptRepository } from '../ports/IPromptRepository';
import { PromptId } from '../value-objects/PromptId';

export async function updatePrompt(repo: IPromptRepository, id: PromptId, update: Partial<Prompt>): Promise<Prompt | null> {
  return repo.update(id, update);
}
