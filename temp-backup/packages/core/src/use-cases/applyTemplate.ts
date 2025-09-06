// Use-case: applyTemplate
import type { Prompt, TemplateVariables, ApplyTemplateResult } from '@sparesparrow/mcp-prompts-contracts';
import type { IPromptRepository } from '../ports/IPromptRepository';
import type { ITemplatingEngine } from '../ports/ITemplatingEngine';

export async function applyTemplate(
  repo: IPromptRepository,
  templatingEngine: ITemplatingEngine,
  id: string,
  variables: TemplateVariables,
  version?: number
): Promise<ApplyTemplateResult> {
  const prompt = await repo.getPrompt(id, version);
  if (!prompt) throw new Error(`Template prompt not found: ${id} v${version ?? 'latest'}`);
  if (!prompt.isTemplate) throw new Error(`Prompt is not a template: ${id}`);
  
  const content = templatingEngine.render(prompt.content, variables);
  const remaining = content.match(/{{[^}]+}}/g);
  const missingVariables = remaining
    ? remaining.map(v => v.replace(/{{|}}/g, '').trim())
    : undefined;
    
  return {
    appliedVariables: variables,
    content,
    missingVariables,
    originalPrompt: prompt,
  };
}
