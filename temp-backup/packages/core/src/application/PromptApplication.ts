// Implementace aplikační vrstvy (IPromptApplication)
import { IPromptRepository } from '../ports/IPromptRepository';
import { 
  Prompt, 
  ListPromptsOptions, 
  TemplateVariables, 
  ApplyTemplateResult 
} from '@sparesparrow/mcp-prompts-contracts';

export interface IPromptApplication {
  getPrompt(id: string, version?: number): Promise<Prompt | null>;
  addPrompt(data: Partial<Prompt>): Promise<Prompt>;
  updatePrompt(id: string, version: number, data: Partial<Prompt>): Promise<Prompt>;
  listPrompts(options?: ListPromptsOptions, allVersions?: boolean): Promise<Prompt[]>;
  deletePrompt(id: string, version?: number): Promise<boolean>;
  listPromptVersions(id: string): Promise<number[]>;
  applyTemplate(
    id: string,
    variables: TemplateVariables,
    version?: number,
  ): Promise<ApplyTemplateResult>;
}

export class PromptApplication implements IPromptApplication {
  constructor(private readonly repo: IPromptRepository) {}

  async addPrompt(data: Partial<Prompt>): Promise<Prompt> {
    const prompt: Prompt = {
      id: data.id || `prompt-${Date.now()}`,
      name: data.name!,
      content: data.content!,
      isTemplate: data.isTemplate || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      description: data.description,
      category: data.category,
      metadata: data.metadata,
      tags: data.tags,
      variables: data.variables
    };
    return this.repo.savePrompt(prompt);
  }

  async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    return this.repo.getPrompt(id, version);
  }

  async listPrompts(options?: ListPromptsOptions, allVersions?: boolean): Promise<Prompt[]> {
    return this.repo.listPrompts(options, allVersions);
  }

  async updatePrompt(id: string, version: number, data: Partial<Prompt>): Promise<Prompt> {
    return this.repo.updatePrompt(id, version, data);
  }

  async deletePrompt(id: string, version?: number): Promise<boolean> {
    return this.repo.deletePrompt(id, version);
  }

  async listPromptVersions(id: string): Promise<number[]> {
    return this.repo.listPromptVersions(id);
  }

  async applyTemplate(
    id: string,
    variables: TemplateVariables,
    version?: number,
  ): Promise<ApplyTemplateResult> {
    const prompt = await this.repo.getPrompt(id, version);
    if (!prompt) throw new Error(`Template prompt not found: ${id} v${version ?? 'latest'}`);
    if (!prompt.isTemplate) throw new Error(`Prompt is not a template: ${id}`);
    
    // Simple template replacement for now
    let content = prompt.content;
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    const remaining = content.match(/{{[^}]+}}/g);
    const missingVariables = remaining
      ? remaining.map(v => v.replace(/{{|}}/g, '').trim())
      : undefined;
      
    return {
      appliedVariables: variables,
      content,
      missingVariables,
      originalPrompt: prompt,
    };
  }
}
