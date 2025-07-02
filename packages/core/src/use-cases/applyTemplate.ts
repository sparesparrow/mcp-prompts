import type { Prompt } from '../entities/Prompt';
import type { ITemplatingEngine } from '../ports/ITemplatingEngine';

export async function applyTemplate(
  templating: ITemplatingEngine,
  prompt: Prompt,
  variables: Record<string, unknown>,
): Promise<string> {
  return templating.render(prompt.template, variables);
}
