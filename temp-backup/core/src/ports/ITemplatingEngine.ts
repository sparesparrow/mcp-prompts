// Secondary port: ITemplatingEngine
import type { TemplateVariables } from '@sparesparrow/mcp-prompts-contracts';

export interface ITemplatingEngine {
  render(template: string, variables: TemplateVariables): string;
}