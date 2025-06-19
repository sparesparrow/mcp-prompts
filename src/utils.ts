/**
 * Applies variables to a string template.
 *
 * Replaces all instances of `{{variable_name}}` with the corresponding value
 * from the variables record. If a variable is not found, the placeholder
 * is left unchanged.
 * @param content The template string.
 * @param variables A record of variable names to their values.
 * @returns The content with variables substituted.
 */
export function applyTemplate(content: string, variables: Record<string, string>): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
    const key = variableName.trim();
    return variables[key] ?? match;
  });
}
