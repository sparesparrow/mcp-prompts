import type { Prompt } from '../entities/Prompt';
import type { TemplateVariable } from '../entities/TemplateVariable';

export class ValidationError extends Error {
  details?: any;
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export function validateTemplateVariables(prompt: Pick<Prompt, 'content' | 'isTemplate' | 'variables'>) {
  if (!prompt.isTemplate) {
    if (prompt.variables && prompt.variables.length > 0) {
      throw new ValidationError('Variables can only be defined for templates.', [
        { path: ['variables'], message: 'Variables can only be defined for templates.' },
      ]);
    }
    return;
  }

  const templateVariables = new Set(
    (prompt.content.match(/{{(.*?)}}/g) || []).map((v: string) => v.replace(/{{|}}/g, '').trim()),
  );

  const declaredVariables = new Set(
    prompt.variables?.map((v: string | TemplateVariable) => (typeof v === 'string' ? v : v.name))
  );

  if (templateVariables.size !== declaredVariables.size) {
    throw new ValidationError(
      'The variables in the template content and the variables field do not match.',
    );
  }

  for (const v of Array.from(templateVariables)) {
    if (!declaredVariables.has(v)) {
      throw new ValidationError(
        `Variable '${v}' is used in the template but not declared in the variables field.`,
      );
    }
  }
}
