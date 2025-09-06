import { Prompt } from '../entities/Prompt';
import { TemplateVariable } from '../value-objects/TemplateVariable';
import { Tag } from '../value-objects/Tag';

/**
 * Use-case: validatePrompt
 * Comprehensive prompt validation with business rules
 */
export async function validatePrompt(prompt: Prompt): Promise<boolean> {
  try {
    // Basic required fields validation
    if (!prompt.name || prompt.name.trim().length === 0) {
      throw new Error('Prompt name is required and cannot be empty');
    }

    if (!prompt.content || prompt.content.trim().length === 0) {
      throw new Error('Prompt content is required and cannot be empty');
    }

    // Name length validation
    if (prompt.name.length > 100) {
      throw new Error('Prompt name cannot exceed 100 characters');
    }

    // Description length validation
    if (prompt.description && prompt.description.length > 500) {
      throw new Error('Prompt description cannot exceed 500 characters');
    }

    // Tags validation
    if (prompt.tags) {
      for (const tag of prompt.tags) {
        if (!Tag.isValid(tag)) {
          throw new Error(`Invalid tag format: ${tag}`);
        }
      }
    }

    // Template variables validation
    if (prompt.isTemplate && prompt.variables) {
      const templateVariables = new Set(
        (prompt.content.match(/{{(.*?)}}/g) || []).map((v: string) => v.replace(/{{|}}/g, '').trim())
      );

      const declaredVariables = new Set(
        prompt.variables.map((v: string | TemplateVariable) => 
          typeof v === 'string' ? v : v.name
        )
      );

      // Check for missing variables
      for (const v of Array.from(templateVariables)) {
        if (!declaredVariables.has(v)) {
          throw new Error(`Variable '${v}' is used in the template but not declared in the variables field`);
        }
      }

      // Check for unused variables
      for (const v of Array.from(declaredVariables)) {
        if (!templateVariables.has(v)) {
          throw new Error(`Variable '${v}' is declared but not used in the template content`);
        }
      }

      // Validate individual variables
      for (const variable of prompt.variables) {
        if (typeof variable === 'string') {
          if (!TemplateVariable.isValidName(variable)) {
            throw new Error(`Invalid variable name: ${variable}`);
          }
        } else {
          if (!TemplateVariable.isValidName(variable.name)) {
            throw new Error(`Invalid variable name: ${variable.name}`);
          }
        }
      }
    }

    // Metadata validation (if present)
    if (prompt.metadata && typeof prompt.metadata !== 'object') {
      throw new Error('Metadata must be an object');
    }

    // Category validation
    if (prompt.category && prompt.category.length > 50) {
      throw new Error('Category cannot exceed 50 characters');
    }

    // Version validation
    if (prompt.version && prompt.version < 1) {
      throw new Error('Version must be a positive integer');
    }

    // Date validation
    if (prompt.createdAt && isNaN(Date.parse(prompt.createdAt))) {
      throw new Error('Invalid createdAt date format');
    }

    if (prompt.updatedAt && isNaN(Date.parse(prompt.updatedAt))) {
      throw new Error('Invalid updatedAt date format');
    }

    return true;
  } catch (error) {
    console.error('Prompt validation failed:', error);
    throw error;
  }
}

/**
 * Validate prompt content for security
 */
export function validatePromptContent(content: string): boolean {
  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers
    /eval\s*\(/gi, // Eval function
    /Function\s*\(/gi, // Function constructor
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      throw new Error('Prompt content contains potentially dangerous patterns');
    }
  }

  return true;
}

/**
 * Validate template variables for consistency
 */
export function validateTemplateVariables(
  content: string, 
  variables: (string | TemplateVariable)[]
): boolean {
  const templateVariables = new Set(
    (content.match(/{{(.*?)}}/g) || []).map((v: string) => v.replace(/{{|}}/g, '').trim())
  );

  const declaredVariables = new Set(
    variables.map((v: string | TemplateVariable) => 
      typeof v === 'string' ? v : v.name
    )
  );

  // Check for missing variables
  for (const v of Array.from(templateVariables)) {
    if (!declaredVariables.has(v)) {
      throw new Error(`Variable '${v}' is used in the template but not declared`);
    }
  }

  // Check for unused variables
  for (const v of Array.from(declaredVariables)) {
    if (!templateVariables.has(v)) {
      throw new Error(`Variable '${v}' is declared but not used in the template`);
    }
  }

  return true;
}
