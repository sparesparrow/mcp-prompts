import type { Prompt } from '../entities/Prompt';
import type { PromptId } from '../value-objects/PromptId';
import type { IPromptRepository } from '../ports/IPromptRepository';

export async function updatePrompt(
  repo: IPromptRepository,
  id: PromptId,
  update: Partial<Prompt>,
): Promise<void> {
  await repo.update(id, update);
}
