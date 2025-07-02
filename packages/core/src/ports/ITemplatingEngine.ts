import type { Template } from '../entities/Template';

export interface ITemplatingEngine {
  render(template: Template, variables: Record<string, unknown>): Promise<string>;
  validate(template: Template): Promise<boolean>;
}
