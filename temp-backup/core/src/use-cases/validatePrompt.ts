// Use-case: validatePrompt
import { Prompt } from '../entities/Prompt';

export function validatePrompt(prompt: Prompt): boolean {
  // Základní validace, lze rozšířit
  return !!prompt.name && !!prompt.content;
}
