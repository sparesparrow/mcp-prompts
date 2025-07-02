// TemplateVariable value object
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
}
