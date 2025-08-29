// Use-case: applyTemplate
import { ITemplatingEngine } from '../ports/ITemplatingEngine';

export function applyTemplate(engine: ITemplatingEngine, template: string, variables: Record<string, string>): string {
  return engine.render(template, variables);
}
