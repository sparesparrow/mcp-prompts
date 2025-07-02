export interface Template {
  id: string;
  content: string;
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
}
