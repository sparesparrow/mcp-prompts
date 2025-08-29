export interface TemplateVariable {
  name: string;
  description?: string;
  default?: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  options?: string[];
}
