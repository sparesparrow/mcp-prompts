import type { IPromptRepository } from '../ports/IPromptRepository';
import type { Prompt } from '../entities/Prompt';
import { validateTemplateVariables } from '../validation/PromptValidation';

export async function addPrompt(repo: IPromptRepository, prompt: Prompt): Promise<Prompt> {
  validateTemplateVariables(prompt);
  // Additional domain rules can be enforced here
  return repo.savePrompt(prompt);
}
