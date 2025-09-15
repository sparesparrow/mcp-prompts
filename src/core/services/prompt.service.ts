#!/usr/bin/env node

import { IPromptRepository } from '../ports/prompt-repository.interface';
import { ICatalogRepository } from '../ports/catalog-repository.interface';
import { IEventBus } from '../ports/event-bus.interface';
import { Prompt } from '../entities/prompt.entity';
import { PromptEvent } from '../events/prompt.event';

export class PromptService {
  constructor(
    private promptRepository: IPromptRepository,
    private catalogRepository: ICatalogRepository,
    private eventBus: IEventBus
  ) {}

  async createPrompt(data: any): Promise<Prompt> {
    const prompt = new Prompt(
      data.id || this.generateId(),
      data.name,
      data.description || '',
      data.template,
      data.category || 'general',
      data.tags || [],
      data.variables || [],
      data.version || 'latest',
      new Date(),
      new Date(),
      true,
      data.metadata || {}
    );

    await this.promptRepository.save(prompt);
    
    // Publish event
    await this.eventBus.publish(new PromptEvent('prompt_created', prompt.id, new Date(), {
      category: prompt.category,
      name: prompt.name
    }));

    return prompt;
  }

  async getPrompt(id: string, version?: string): Promise<Prompt | null> {
    const prompt = await this.promptRepository.findById(id, version);
    
    if (prompt) {
      // Publish access event
      await this.eventBus.publish(new PromptEvent('prompt_accessed', prompt.id, new Date(), {
        version: prompt.version
      }));
    }

    return prompt;
  }

  async updatePrompt(id: string, data: any): Promise<Prompt> {
    const existingPrompt = await this.promptRepository.findById(id);
    if (!existingPrompt) {
      throw new Error('Prompt not found');
    }

    const updatedPrompt = new Prompt(
      existingPrompt.id,
      data.name || existingPrompt.name,
      data.description || existingPrompt.description,
      data.template || existingPrompt.template,
      data.category || existingPrompt.category,
      data.tags || existingPrompt.tags,
      data.variables || existingPrompt.variables,
      existingPrompt.version,
      existingPrompt.createdAt,
      new Date(),
      existingPrompt.isLatest,
      { ...existingPrompt.metadata, ...data.metadata }
    );

    await this.promptRepository.save(updatedPrompt);
    
    // Publish event
    await this.eventBus.publish(new PromptEvent('prompt_updated', updatedPrompt.id, new Date(), {
      category: updatedPrompt.category,
      name: updatedPrompt.name
    }));

    return updatedPrompt;
  }

  async deletePrompt(id: string): Promise<void> {
    const existingPrompt = await this.promptRepository.findById(id);
    if (!existingPrompt) {
      throw new Error('Prompt not found');
    }

    await this.promptRepository.delete(id);
    
    // Publish event
    await this.eventBus.publish(new PromptEvent('prompt_deleted', id, new Date(), {
      category: existingPrompt.category,
      name: existingPrompt.name
    }));
  }

  async getPromptsByCategory(category: string, limit: number = 50): Promise<Prompt[]> {
    return await this.promptRepository.findByCategory(category, limit);
  }

  async getLatestPrompts(limit: number = 100): Promise<Prompt[]> {
    return await this.promptRepository.findLatestVersions(limit);
  }

  async searchPrompts(query: string, category?: string): Promise<Prompt[]> {
    return await this.promptRepository.search(query, category);
  }

  async applyTemplate(promptId: string, variables: Record<string, any>): Promise<string> {
    const prompt = await this.getPrompt(promptId);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    let template = prompt.template;
    
    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      template = template.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return template;
  }

  async syncFromCatalog(): Promise<void> {
    // This would sync prompts from the catalog repository
    // Implementation depends on catalog structure
    console.log('Syncing prompts from catalog...');
  }

  private generateId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}