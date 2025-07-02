import type { PromptId } from '../value-objects/PromptId';
import type { IPromptRepository } from '../ports/IPromptRepository';

export async function deletePrompt(repo: IPromptRepository, id: PromptId): Promise<void> {
  await repo.delete(id);
}
