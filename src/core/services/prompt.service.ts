#!/usr/bin/env node

import { IPromptRepository } from '../ports/prompt-repository.interface';
import { ICatalogRepository } from '../ports/catalog-repository.interface';
import { IEventBus } from '../ports/event-bus.interface';
import { Prompt } from '../entities/prompt.entity';
import { PromptEvent } from '../events/prompt.event';
import { ValidationError, NotFoundError } from '../errors/custom-errors';

interface UserContext {
  userId?: string;
  subscriptionTier?: 'free' | 'premium';
  email?: string;
}

export class PromptService {
  constructor(
    private promptRepository: IPromptRepository,
    private catalogRepository: ICatalogRepository,
    private eventBus: IEventBus
  ) {}

  async createPrompt(data: any): Promise<Prompt> {
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      throw new ValidationError('Prompt name is required and must be a non-empty string');
    }
    if (!data.template || typeof data.template !== 'string' || data.template.trim() === '') {
      throw new ValidationError('Prompt template is required and must be a non-empty string');
    }

    const prompt = new Prompt(
      data.id || this.generateId(),
      data.name.trim(),
      data.description || '',
      data.template,
      data.category || 'general',
      data.tags || [],
      data.variables || [],
      data.version || 'latest',
      new Date(),
      new Date(),
      true,
      data.metadata || {},
      data.access_level || 'public',
      data.author_id
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
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new ValidationError('Prompt ID is required and must be a non-empty string');
    }

    const existingPrompt = await this.promptRepository.findById(id);
    if (!existingPrompt) {
      throw new NotFoundError(`Prompt with ID ${id} not found`);
    }

    if (data.name && (typeof data.name !== 'string' || data.name.trim() === '')) {
      throw new ValidationError('Prompt name must be a non-empty string');
    }
    if (data.template && (typeof data.template !== 'string' || data.template.trim() === '')) {
      throw new ValidationError('Prompt template must be a non-empty string');
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
      { ...existingPrompt.metadata, ...data.metadata },
      data.access_level || existingPrompt.accessLevel,
      data.author_id || existingPrompt.authorId
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
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new ValidationError('Prompt ID is required and must be a non-empty string');
    }

    const existingPrompt = await this.promptRepository.findById(id);
    if (!existingPrompt) {
      throw new NotFoundError(`Prompt with ID ${id} not found`);
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

  async getLatestPrompts(limit: number = 100, userContext?: UserContext): Promise<Prompt[]> {
    const allPrompts = await this.promptRepository.findLatestVersions(limit * 2); // Get more to filter

    // Filter prompts based on user access
    return allPrompts.filter(prompt => this.hasAccessToPrompt(prompt, userContext)).slice(0, limit);
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

  // Access control methods
  hasAccessToPrompt(prompt: Prompt, userContext?: UserContext): boolean {
    // If no user context, only allow public prompts
    if (!userContext) {
      return prompt.accessLevel === 'public';
    }

    const accessLevel = prompt.accessLevel || 'public';

    switch (accessLevel) {
      case 'public':
        return true;
      case 'premium':
        return userContext.subscriptionTier === 'premium';
      case 'private':
        return prompt.authorId === userContext.userId;
      default:
        return false;
    }
  }

  canCreatePrompt(userContext?: UserContext): boolean {
    if (!userContext) return false;

    // Free users have limited uploads, premium users have unlimited
    return userContext.subscriptionTier === 'premium';
  }

  canUploadPrompt(userContext?: UserContext, currentUploadCount: number = 0): boolean {
    if (!userContext) return false;

    if (userContext.subscriptionTier === 'premium') return true;
    if (userContext.subscriptionTier === 'free') return currentUploadCount < 5;

    return false;
  }

  getRateLimit(userContext?: UserContext): { requests: number; windowMs: number } {
    if (!userContext || userContext.subscriptionTier === 'free') {
      return { requests: 100, windowMs: 60 * 60 * 1000 }; // 100 requests per hour
    } else {
      return { requests: 1000, windowMs: 60 * 60 * 1000 }; // 1000 requests per hour
    }
  }

  private generateId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}