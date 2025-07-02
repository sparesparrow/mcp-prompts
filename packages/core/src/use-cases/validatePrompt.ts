// Use-case: validatePrompt
import { Prompt } from '@sparesparrow/mcp-prompts-contracts';

export function validatePrompt(prompt: Prompt): boolean {
  // Základní validace, lze rozšířit
  return !!prompt.name && !!prompt.content;
}
