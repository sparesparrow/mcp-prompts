export interface PromptProps {
  id: string; // Consider using a PromptId value object
  name: string;
  content: string;
  isTemplate: boolean;
  variables: string[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class Prompt {
  id: string;
  name: string;
  content: string;
  isTemplate: boolean;
  variables: string[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;

  constructor(props: PromptProps) {
    this.id = props.id;
    this.name = props.name;
    this.content = props.content;
    this.isTemplate = props.isTemplate;
    this.variables = props.variables;
    this.tags = props.tags;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  updateContent(newContent: string) {
    this.content = newContent;
    this.updatedAt = new Date();
  }
} 