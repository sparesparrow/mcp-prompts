#!/usr/bin/env node

import { IPromptRepository, SubagentFilter } from '../ports/prompt-repository.interface';
import { IEventBus } from '../ports/event-bus.interface';
import { Prompt, ClaudeModel } from '../entities/prompt.entity';
import { PromptEvent } from '../events/prompt.event';
import { ValidationError, NotFoundError } from '../errors/custom-errors';

/**
 * Statistics for a subagent
 */
export interface SubagentStats {
  id: string;
  name: string;
  executionCount: number;
  successRate: number;
  lastExecutedAt?: Date;
  avgCost?: number;
  avgTokens?: number;
}

/**
 * Service for managing subagents
 */
export class SubagentService {
  constructor(
    private promptRepository: IPromptRepository,
    private eventBus: IEventBus
  ) {}

  /**
   * Get all available subagents with optional filtering
   */
  async listSubagents(filter?: SubagentFilter, limit?: number): Promise<Prompt[]> {
    const subagents = await this.promptRepository.findSubagents(filter, limit);

    // Publish event for analytics
    await this.eventBus.publish(new PromptEvent('subagents_listed', 'system', new Date(), {
      filter,
      count: subagents.length
    }));

    return subagents;
  }

  /**
   * Get a specific subagent by ID
   */
  async getSubagent(id: string): Promise<Prompt> {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new ValidationError('Subagent ID is required and must be a non-empty string');
    }

    const subagent = await this.promptRepository.findById(id);

    if (!subagent) {
      throw new NotFoundError(`Subagent with ID ${id} not found`);
    }

    if (!subagent.isSubagent()) {
      throw new ValidationError(`Prompt ${id} is not a subagent`);
    }

    // Publish access event
    await this.eventBus.publish(new PromptEvent('subagent_accessed', subagent.id, new Date(), {
      category: subagent.category,
      model: subagent.getModel()
    }));

    return subagent;
  }

  /**
   * Get subagents by category
   */
  async getSubagentsByCategory(category: string, limit?: number): Promise<Prompt[]> {
    if (!category || typeof category !== 'string' || category.trim() === '') {
      throw new ValidationError('Category is required and must be a non-empty string');
    }

    return this.listSubagents({ category }, limit);
  }

  /**
   * Get subagents by tags
   */
  async getSubagentsByTags(tags: string[], limit?: number): Promise<Prompt[]> {
    if (!Array.isArray(tags) || tags.length === 0) {
      throw new ValidationError('Tags must be a non-empty array');
    }

    // Validate all tags are strings
    if (!tags.every(tag => typeof tag === 'string' && tag.trim() !== '')) {
      throw new ValidationError('All tags must be non-empty strings');
    }

    return this.listSubagents({ tags }, limit);
  }

  /**
   * Get subagents by model
   */
  async getSubagentsByModel(model: ClaudeModel, limit?: number): Promise<Prompt[]> {
    const validModels: ClaudeModel[] = ['claude-opus', 'claude-sonnet', 'claude-haiku'];
    if (!validModels.includes(model)) {
      throw new ValidationError(`Invalid model. Must be one of: ${validModels.join(', ')}`);
    }

    return this.listSubagents({ model }, limit);
  }

  /**
   * Get subagents compatible with a specific project type
   */
  async getSubagentsForProjectType(projectType: string, limit?: number): Promise<Prompt[]> {
    if (!projectType || typeof projectType !== 'string' || projectType.trim() === '') {
      throw new ValidationError('Project type is required and must be a non-empty string');
    }

    return this.listSubagents({ compatibleWith: projectType }, limit);
  }

  /**
   * Get all available subagent categories
   */
  async getCategories(): Promise<string[]> {
    return this.promptRepository.getSubagentCategories();
  }

  /**
   * Get all models used by subagents
   */
  async getModels(): Promise<ClaudeModel[]> {
    return this.promptRepository.getAgentModels();
  }

  /**
   * Get execution statistics for a subagent
   */
  async getStats(id: string): Promise<SubagentStats> {
    const subagent = await this.getSubagent(id);

    return {
      id: subagent.id,
      name: subagent.name,
      executionCount: subagent.agentConfig?.executionCount || 0,
      successRate: subagent.agentConfig?.successRate || 0,
      lastExecutedAt: subagent.agentConfig?.lastExecutedAt,
      avgCost: this.estimateCost(subagent),
      avgTokens: this.estimateTokens(subagent)
    };
  }

  /**
   * Record an execution of a subagent
   */
  async recordExecution(
    id: string,
    success: boolean,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    const subagent = await this.getSubagent(id);

    const currentCount = subagent.agentConfig?.executionCount || 0;
    const currentSuccessRate = subagent.agentConfig?.successRate || 0;

    // Calculate new success rate
    const totalExecutions = currentCount + 1;
    const successfulExecutions = Math.round((currentSuccessRate / 100) * currentCount) + (success ? 1 : 0);
    const newSuccessRate = (successfulExecutions / totalExecutions) * 100;

    // Update stats
    await this.promptRepository.updateExecutionStats(
      id,
      totalExecutions,
      newSuccessRate,
      new Date()
    );

    // Publish event
    await this.eventBus.publish(new PromptEvent('subagent_executed', id, new Date(), {
      success,
      inputTokens,
      outputTokens,
      totalExecutions,
      successRate: newSuccessRate
    }));
  }

  /**
   * Search subagents by query string
   */
  async search(query: string, category?: string, limit?: number): Promise<Prompt[]> {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      throw new ValidationError('Search query is required and must be a non-empty string');
    }

    // Get all subagents (filtered by category if provided)
    const filter: SubagentFilter = category ? { category } : {};
    const allSubagents = await this.listSubagents(filter, 10000);

    const lowerQuery = query.toLowerCase();

    // Search in name, description, tags, and system prompt
    const results = allSubagents.filter(subagent => {
      return (
        subagent.name.toLowerCase().includes(lowerQuery) ||
        subagent.description.toLowerCase().includes(lowerQuery) ||
        subagent.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        (subagent.getSystemPrompt()?.toLowerCase().includes(lowerQuery) || false)
      );
    });

    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Validate a subagent configuration
   */
  validateSubagentConfig(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push('Name is required and must be a non-empty string');
    }

    if (!data.description || typeof data.description !== 'string') {
      errors.push('Description is required and must be a string');
    }

    if (!data.category || typeof data.category !== 'string') {
      errors.push('Category is required and must be a string');
    }

    if (!data.model || !['claude-opus', 'claude-sonnet', 'claude-haiku'].includes(data.model)) {
      errors.push('Model must be one of: claude-opus, claude-sonnet, claude-haiku');
    }

    if (!data.system_prompt || typeof data.system_prompt !== 'string' || data.system_prompt.trim() === '') {
      errors.push('System prompt is required and must be a non-empty string');
    }

    if (data.tools && (!Array.isArray(data.tools) || !data.tools.every((t: any) => typeof t === 'string'))) {
      errors.push('Tools must be an array of strings');
    }

    if (data.tags && (!Array.isArray(data.tags) || !data.tags.every((t: any) => typeof t === 'string'))) {
      errors.push('Tags must be an array of strings');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Estimate cost per execution based on model
   */
  private estimateCost(subagent: Prompt): number {
    const model = subagent.getModel();
    const avgTokens = this.estimateTokens(subagent);

    // Approximate pricing (per 1M tokens)
    const pricing = {
      'claude-opus': 15, // $15 per 1M input tokens
      'claude-sonnet': 3, // $3 per 1M input tokens
      'claude-haiku': 0.25 // $0.25 per 1M input tokens
    };

    const pricePerToken = pricing[model || 'claude-sonnet'] / 1_000_000;
    return avgTokens * pricePerToken;
  }

  /**
   * Estimate average tokens per execution
   */
  private estimateTokens(subagent: Prompt): number {
    // Rough estimate: system prompt length / 4 (chars per token)
    const systemPrompt = subagent.getSystemPrompt() || '';
    const inputTokens = Math.ceil(systemPrompt.length / 4);

    // Assume output is 50% of input on average
    const outputTokens = Math.ceil(inputTokens * 0.5);

    return inputTokens + outputTokens;
  }
}
