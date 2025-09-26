import { Prompt } from '../core/entities/prompt.entity';
import { IPromptRepository } from '../core/ports/prompt-repository.interface';
import { ICatalogRepository } from '../core/ports/catalog-repository.interface';
import { IEventBus, PromptEvent } from '../core/ports/event-bus.interface';
import { logger } from '../utils';

// Simple in-memory storage for prompts
const prompts = new Map<string, Prompt>();

export class MemoryPromptRepository implements IPromptRepository {
  async save(prompt: Prompt): Promise<void> {
    prompts.set(prompt.id, prompt);
    logger.info(`Saved prompt: ${prompt.id}`);
  }

  async findById(id: string, version?: string): Promise<Prompt | null> {
    const prompt = prompts.get(id);
    return prompt || null;
  }

  async findByCategory(category: string, limit?: number): Promise<Prompt[]> {
    const categoryPrompts = Array.from(prompts.values())
      .filter(p => p.category === category)
      .slice(0, limit || 50);
    return categoryPrompts;
  }

  async findLatestVersions(limit?: number): Promise<Prompt[]> {
    const latestPrompts = Array.from(prompts.values())
      .filter(p => p.isLatest)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit || 50);
    return latestPrompts;
  }

  async search(query: string, category?: string): Promise<Prompt[]> {
    let searchResults = Array.from(prompts.values());
    
    if (category) {
      searchResults = searchResults.filter(p => p.category === category);
    }
    
    const queryLower = query.toLowerCase();
    searchResults = searchResults.filter(p => 
      p.name.toLowerCase().includes(queryLower) ||
      p.template.toLowerCase().includes(queryLower) ||
      p.tags.some(tag => tag.toLowerCase().includes(queryLower))
    );
    
    return searchResults;
  }

  async update(id: string, version: string, updates: Partial<Prompt>): Promise<void> {
    const existingPrompt = prompts.get(id);
    if (!existingPrompt) {
      throw new Error(`Prompt with ID ${id} not found`);
    }

    const updatedPrompt = new Prompt(
      existingPrompt.id,
      updates.name || existingPrompt.name,
      updates.description || existingPrompt.description,
      updates.template || existingPrompt.template,
      updates.category || existingPrompt.category,
      updates.tags || existingPrompt.tags,
      updates.variables || existingPrompt.variables,
      version,
      existingPrompt.createdAt,
      new Date(),
      updates.isLatest !== undefined ? updates.isLatest : existingPrompt.isLatest,
      updates.metadata || existingPrompt.metadata
    );

    prompts.set(id, updatedPrompt);
    logger.info(`Updated prompt: ${id}`);
  }

  async delete(id: string, version?: string): Promise<void> {
    const prompt = prompts.get(id);
    if (!prompt) {
      throw new Error(`Prompt with ID ${id} not found`);
    }
    
    prompts.delete(id);
    logger.info(`Deleted prompt: ${id}`);
  }

  async getVersions(id: string): Promise<string[]> {
    const prompt = prompts.get(id);
    return prompt ? [prompt.version] : [];
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    return {
      status: 'healthy',
      details: {
        totalPrompts: prompts.size,
        storage: 'memory'
      }
    };
  }
}

export class MemoryCatalogRepository implements ICatalogRepository {
  async syncFromGitHub(repoUrl: string): Promise<void> {
    logger.info(`GitHub sync requested for ${repoUrl} (memory mode - no action needed)`);
  }

  async getPromptTemplate(category: string, name: string): Promise<string> {
    const prompt = Array.from(prompts.values()).find(p => 
      p.category === category && p.name === name
    );
    return prompt ? prompt.template : '';
  }

  async getCatalogIndex(): Promise<any> {
    return {
      prompts: Array.from(prompts.values()),
      metadata: {
        total: prompts.size,
        lastUpdated: new Date().toISOString()
      }
    };
  }

  async uploadPrompt(category: string, name: string, content: any): Promise<void> {
    logger.info(`Upload prompt requested: ${category}/${name} (memory mode - no action needed)`);
  }

  async deletePrompt(category: string, name: string): Promise<void> {
    logger.info(`Delete prompt requested: ${category}/${name} (memory mode - no action needed)`);
  }

  async listPrompts(category?: string): Promise<string[]> {
    const filteredPrompts = category 
      ? Array.from(prompts.values()).filter(p => p.category === category)
      : Array.from(prompts.values());
    return filteredPrompts.map(p => p.name);
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    return {
      status: 'healthy',
      details: {
        storage: 'memory'
      }
    };
  }
}

export class MemoryEventBus implements IEventBus {
  async publish(event: PromptEvent): Promise<void> {
    logger.info('Event published (memory mode):', event.type);
  }

  async subscribe(eventType: string, handler: (event: PromptEvent) => Promise<void>): Promise<void> {
    logger.info(`Subscribed to ${eventType} events (memory mode)`);
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    return {
      status: 'healthy',
      details: {
        storage: 'memory'
      }
    };
  }
}

// Load sample prompts on startup
export function loadSamplePrompts() {
  try {
    const fs = require('fs');
    const path = require('path');
    const sampleDataPath = path.join(process.cwd(), 'data', 'sample-prompts.json');
    const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
    
    for (const promptData of sampleData.prompts) {
      const prompt = new Prompt(
        promptData.id,
        promptData.name,
        promptData.description || promptData.name,
        promptData.content || promptData.template,
        promptData.category || 'general',
        promptData.tags || [],
        promptData.variables || [],
        'latest',
        new Date(),
        new Date(),
        true,
        promptData.metadata || {}
      );
      prompts.set(prompt.id, prompt);
    }
    logger.info(`Loaded ${sampleData.prompts.length} sample prompts into memory`);
  } catch (error) {
    logger.warn('Could not load sample prompts:', error);
  }
}
