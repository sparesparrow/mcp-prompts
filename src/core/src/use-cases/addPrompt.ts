// Use-case: addPrompt
import { Prompt } from '../entities/Prompt';
import { IPromptRepository } from '../ports/IPromptRepository';

export async function addPrompt(repo: IPromptRepository, prompt: Prompt): Promise<Prompt> {
  // Validace, business logika atd. může být doplněna
  return repo.add(prompt);
}
