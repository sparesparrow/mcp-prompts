import type { IPromptRepository } from '../ports/IPromptRepository';
import type { Prompt } from '../entities/Prompt';
import { validateTemplateVariables } from '../validation/PromptValidation';

export async function updatePrompt(
  repo: IPromptRepository,
  id: string,
  version: number,
  data: Partial<Prompt>
): Promise<Prompt> {
  // Fetch existing prompt for merging and validation
  const existing = await repo.getPrompt(id, version);
  if (!existing) throw new Error(`Prompt not found: ${id} v${version}`);
  const updated: Prompt = { ...existing, ...data, id, version, updatedAt: new Date().toISOString() };
  validateTemplateVariables(updated);
  return repo.updatePrompt(id, version, updated);
}
