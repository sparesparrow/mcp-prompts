// Use-case: updatePrompt
import { Prompt } from '@sparesparrow/mcp-prompts-contracts';
import { IPromptRepository } from '../ports/IPromptRepository';

export async function updatePrompt(repo: IPromptRepository, id: string, version: number, data: Partial<Prompt>): Promise<Prompt> {
  // Convert metadata: null to undefined, tags: null to undefined, variables: null to undefined for type compatibility
  const fixedData = {
    ...data,
    metadata: data.metadata === null ? undefined : data.metadata,
    tags: data.tags === null ? undefined : data.tags,
    variables: data.variables === null ? undefined : data.variables,
  };
  return repo.updatePrompt(id, version, fixedData);
}
