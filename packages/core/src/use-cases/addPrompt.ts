import type { Prompt } from '../entities/Prompt';
import type { IPromptRepository } from '../ports/IPromptRepository';

export async function addPrompt(repo: IPromptRepository, prompt: Prompt): Promise<Prompt> {
  await repo.save(prompt);
  return prompt;
}
