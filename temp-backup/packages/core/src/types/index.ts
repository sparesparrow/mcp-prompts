export type TemplateVariables = Record<string, string>;

export interface ApplyTemplateResult {
  content: string;
  originalPrompt: import('../entities/Prompt').Prompt;
  appliedVariables: TemplateVariables;
  missingVariables?: string[];
}
