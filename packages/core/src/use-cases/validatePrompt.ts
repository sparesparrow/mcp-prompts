import type { Prompt } from '../entities/Prompt';
import type { ITemplatingEngine } from '../ports/ITemplatingEngine';

export async function validatePrompt(
  templating: ITemplatingEngine,
  prompt: Prompt,
): Promise<boolean> {
  return templating.validate(prompt.template);
}
